import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

/** 기본 DB 경로: server/data/mulga.db (MULGA_DB_PATH로 재정의 가능) */
export function defaultDbPath(): string {
  return (
    process.env['MULGA_DB_PATH'] ??
    fileURLToPath(new URL('../../data/mulga.db', import.meta.url))
  )
}

/**
 * 일일 가격 이력 저장소 (SQLite).
 * 하루 품목당 1행, (date, item_id) 기본키로 재수집 시 덮어쓴다.
 * raw_json에 KAMIS 원본 행을 보존해 판정 로직 변경 시 재계산할 수 있게 한다.
 * 데이터 규모가 작아(품목 20개 × 일 1행) 파일 DB로 충분하며,
 * PriceHistoryRepository 인터페이스 뒤에 숨겨 추후 PostgreSQL 전환에 대비한다.
 */

export interface PriceRecord {
  readonly itemId: string
  readonly price: number
  readonly normalPrice: number
  readonly unit: string
  readonly source: string
  readonly rawJson: string | null
}

export interface HistoryRow {
  readonly date: string
  readonly price: number
  readonly normalPrice: number
  readonly unit: string
}

export interface LatestRecord {
  readonly date: string
  readonly price: number
  readonly normalPrice: number
  readonly unit: string
  readonly rawJson: string | null
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export class PriceHistoryRepository {
  private constructor(private readonly db: Database.Database) {}

  /** 파일 경로 또는 ':memory:'로 연다. 디렉터리와 스키마는 자동 생성 */
  static open(path: string): PriceHistoryRepository {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }
    const db = new Database(path)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        date         TEXT    NOT NULL,
        item_id      TEXT    NOT NULL,
        price        INTEGER NOT NULL,
        normal_price INTEGER NOT NULL,
        unit         TEXT    NOT NULL,
        source       TEXT    NOT NULL,
        raw_json     TEXT,
        fetched_at   TEXT    NOT NULL,
        PRIMARY KEY (date, item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_price_history_item
        ON price_history (item_id, date);
    `)
    return new PriceHistoryRepository(db)
  }

  upsertMany(date: string, records: readonly PriceRecord[]): void {
    if (!DATE_PATTERN.test(date)) {
      throw new RangeError(`날짜는 YYYY-MM-DD 형식이어야 합니다: ${date}`)
    }
    const upsert = this.db.prepare(`
      INSERT INTO price_history
        (date, item_id, price, normal_price, unit, source, raw_json, fetched_at)
      VALUES (@date, @itemId, @price, @normalPrice, @unit, @source, @rawJson, @fetchedAt)
      ON CONFLICT (date, item_id) DO UPDATE SET
        price = excluded.price,
        normal_price = excluded.normal_price,
        unit = excluded.unit,
        source = excluded.source,
        raw_json = excluded.raw_json,
        fetched_at = excluded.fetched_at
    `)
    const fetchedAt = new Date().toISOString()
    const insertAll = this.db.transaction((rows: readonly PriceRecord[]) => {
      for (const record of rows) {
        upsert.run({ ...record, date, fetchedAt })
      }
    })
    insertAll(records)
  }

  /** 기준일로부터 최근 N일 이력을 날짜 오름차순으로 반환 */
  getHistory(
    itemId: string,
    days: number,
    now: Date = new Date(),
  ): readonly HistoryRow[] {
    if (!Number.isInteger(days) || days <= 0) {
      throw new RangeError(`days는 양의 정수여야 합니다: ${days}`)
    }
    const since = new Date(now)
    since.setUTCDate(since.getUTCDate() - days)
    const rows = this.db
      .prepare(
        `SELECT date, price, normal_price, unit FROM price_history
         WHERE item_id = ? AND date >= ?
         ORDER BY date ASC`,
      )
      .all(itemId, since.toISOString().slice(0, 10))
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      date: String(row['date']),
      price: Number(row['price']),
      normalPrice: Number(row['normal_price']),
      unit: String(row['unit']),
    }))
  }

  /** 품목의 가장 최근 적재 레코드 (raw_json 포함). 없으면 null */
  getLatestRecord(itemId: string): LatestRecord | null {
    const row = this.db
      .prepare(
        `SELECT date, price, normal_price, unit, raw_json FROM price_history
         WHERE item_id = ? ORDER BY date DESC LIMIT 1`,
      )
      .get(itemId) as Record<string, unknown> | undefined
    if (row === undefined) return null
    return {
      date: String(row['date']),
      price: Number(row['price']),
      normalPrice: Number(row['normal_price']),
      unit: String(row['unit']),
      rawJson: row['raw_json'] === null ? null : String(row['raw_json']),
    }
  }

  /** 가장 최근 적재 날짜. 비어 있으면 null */
  latestDate(): string | null {
    const row = this.db
      .prepare('SELECT MAX(date) AS latest FROM price_history')
      .get() as { latest: string | null }
    return row.latest
  }

  close(): void {
    this.db.close()
  }
}
