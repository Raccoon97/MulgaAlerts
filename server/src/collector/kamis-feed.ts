import {
  KamisClient,
  type KamisDailyRow,
} from './kamis.js'
import type {
  PriceHistoryRepository,
  PriceRecord,
} from '../db/price-history.js'
import {
  deviationRate,
  judgeMovement,
  judgeVerdict,
  type Movement,
  type Verdict,
} from '../domain/verdict.js'

/**
 * MVP 품목 → KAMIS 코드 매핑 (2026-07 실측).
 * kind/rank는 소비 빈도가 높은 대표 규격 하나를 고른다.
 * 계절 kind(배추 봄/여름 등)는 가격이 조사된 행을 우선 선택한다.
 */
export interface CatalogEntry {
  readonly id: string
  readonly name: string
  readonly category: '채소' | '과일' | '축산' | '수산' | '곡물'
  readonly kamisCategory: string
  readonly itemCode: string
  /** 허용 kind 목록 — 앞선 것 우선, 가격 없으면 다음 후보 */
  readonly kindCodes: readonly string[]
  readonly rankCodes: readonly string[]
}

export const ITEM_CATALOG: readonly CatalogEntry[] = [
  { id: 'cabbage', name: '배추', category: '채소', kamisCategory: '200', itemCode: '211', kindCodes: ['02', '01'], rankCodes: ['04'] },
  { id: 'zucchini', name: '애호박', category: '채소', kamisCategory: '200', itemCode: '224', kindCodes: ['01'], rankCodes: ['04'] },
  { id: 'lettuce', name: '상추', category: '채소', kamisCategory: '200', itemCode: '214', kindCodes: ['02', '01'], rankCodes: ['04'] },
  { id: 'cucumber', name: '오이', category: '채소', kamisCategory: '200', itemCode: '223', kindCodes: ['02', '01'], rankCodes: ['04'] },
  { id: 'onion', name: '양파', category: '채소', kamisCategory: '200', itemCode: '245', kindCodes: ['00'], rankCodes: ['04'] },
  { id: 'potato', name: '감자', category: '채소', kamisCategory: '100', itemCode: '152', kindCodes: ['01'], rankCodes: ['04'] },
  { id: 'radish', name: '무', category: '채소', kamisCategory: '200', itemCode: '231', kindCodes: ['01', '02'], rankCodes: ['04'] },
  { id: 'green-onion', name: '대파', category: '채소', kamisCategory: '200', itemCode: '246', kindCodes: ['00'], rankCodes: ['04'] },
  { id: 'tomato', name: '토마토', category: '과일', kamisCategory: '200', itemCode: '225', kindCodes: ['00'], rankCodes: ['04'] },
  { id: 'watermelon', name: '수박', category: '과일', kamisCategory: '200', itemCode: '221', kindCodes: ['00'], rankCodes: ['04'] },
  { id: 'apple', name: '사과', category: '과일', kamisCategory: '400', itemCode: '411', kindCodes: ['05', '06'], rankCodes: ['04'] },
  { id: 'banana', name: '바나나', category: '과일', kamisCategory: '400', itemCode: '418', kindCodes: ['02'], rankCodes: ['04'] },
  { id: 'egg', name: '계란', category: '축산', kamisCategory: '500', itemCode: '9903', kindCodes: ['23'], rankCodes: ['71'] },
  { id: 'pork-belly', name: '삼겹살', category: '축산', kamisCategory: '500', itemCode: '4304', kindCodes: ['27'], rankCodes: ['00'] },
  { id: 'chicken', name: '닭고기', category: '축산', kamisCategory: '500', itemCode: '9901', kindCodes: ['99'], rankCodes: ['00'] },
  { id: 'mackerel', name: '고등어', category: '수산', kamisCategory: '600', itemCode: '611', kindCodes: ['05'], rankCodes: ['20', '21'] },
  { id: 'squid', name: '오징어', category: '수산', kamisCategory: '600', itemCode: '619', kindCodes: ['03', '05', '04'], rankCodes: ['21', '20'] },
  { id: 'rice', name: '쌀', category: '곡물', kamisCategory: '100', itemCode: '111', kindCodes: ['01'], rankCodes: ['04'] },
]

export interface FeedItem {
  readonly id: string
  readonly name: string
  readonly unit: string
  readonly category: string
  readonly price: number
  readonly prevPrice: number
  readonly normalPrice: number
  readonly deviationRate: number
  readonly verdict: Verdict
  readonly movement: Movement
}

export interface KamisFeed {
  readonly items: readonly FeedItem[]
  /** 조회 기준일 YYYY-MM-DD */
  readonly asOf: string
  /** 매핑은 됐지만 가격 데이터가 없어 제외된 품목 id */
  readonly missing: readonly string[]
}

/** 카탈로그 항목에 맞는 후보 행들을 우선순위 순으로 반환 */
export function rankCandidates(
  entry: CatalogEntry,
  rows: readonly KamisDailyRow[],
): readonly KamisDailyRow[] {
  const candidates = rows.filter(
    (row) =>
      row.itemCode === entry.itemCode &&
      entry.kindCodes.includes(row.kindCode) &&
      entry.rankCodes.includes(row.rankCode),
  )
  const score = (row: KamisDailyRow): number =>
    entry.kindCodes.indexOf(row.kindCode) * 10 +
    entry.rankCodes.indexOf(row.rankCode) +
    ((row.today ?? row.dayAgo) === null ? 100 : 0) // 가격 없는 행은 후순위
  return [...candidates].sort((a, b) => score(a) - score(b))
}

/** 최우선 후보 행 하나. 계절 kind 중 가격이 조사된 행이 우선된다 */
export function pickRow(
  entry: CatalogEntry,
  rows: readonly KamisDailyRow[],
): KamisDailyRow | null {
  return rankCandidates(entry, rows).at(0) ?? null
}

/**
 * 행 하나를 API 아이템으로 변환.
 * price = 당일가(미조사면 1일전가), prev = 그 직전 조사가(없으면 1개월전까지 폴백).
 * normal = 일평년가(없으면 1년전가). price/normal이 없으면 null.
 */
export function buildFeedItem(
  entry: CatalogEntry,
  row: KamisDailyRow,
): FeedItem | null {
  const price = row.today ?? row.dayAgo
  const prevPrice =
    (row.today !== null ? row.dayAgo : null) ?? row.weekAgo ?? row.monthAgo
  const normalPrice = row.normalYear ?? row.yearAgo
  if (price === null || prevPrice === null || normalPrice === null) return null
  return {
    id: entry.id,
    name: entry.name,
    unit: row.unit,
    category: entry.category,
    price,
    prevPrice,
    normalPrice,
    deviationRate: deviationRate(price, normalPrice),
    verdict: judgeVerdict(price, normalPrice),
    movement: judgeMovement(price, prevPrice),
  }
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1시간 — KAMIS는 일 단위 데이터
const MAX_LOOKBACK_ATTEMPTS = 4
const GOOD_ENOUGH_RATIO = 0.7

/**
 * 조회 기준일 계산: 주말이면 직전 금요일로.
 * 농수산물은 주말·휴일에 조사가 없어 당일 조회 시 대부분 미조사("-")가 된다.
 */
export function lastBusinessDay(from: Date, offsetDays: number): string {
  const date = new Date(from)
  date.setUTCDate(date.getUTCDate() - offsetDays)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

interface FeedLogger {
  error(context: Record<string, unknown>, message: string): void
}

interface BuildResult {
  readonly feed: KamisFeed
  readonly records: readonly PriceRecord[]
}

export class KamisFeedService {
  private cache: { feed: KamisFeed; fetchedAt: number } | null = null

  constructor(
    private readonly client: KamisClient,
    private readonly repository: PriceHistoryRepository | null = null,
    private readonly logger: FeedLogger = console,
  ) {}

  private async buildForDate(regday: string): Promise<BuildResult> {
    const categories = [...new Set(ITEM_CATALOG.map((e) => e.kamisCategory))]
    const rowsByCategory = new Map<string, readonly KamisDailyRow[]>()
    // KAMIS 서버 부하를 피하기 위해 순차 호출
    for (const category of categories) {
      rowsByCategory.set(
        category,
        await this.client.fetchDailyPricesByCategory(category, regday),
      )
    }

    const items: FeedItem[] = []
    const records: PriceRecord[] = []
    const missing: string[] = []
    for (const entry of ITEM_CATALOG) {
      const rows = rowsByCategory.get(entry.kamisCategory) ?? []
      // 우선순위 순으로 후보 행을 시도해, 데이터가 온전한 첫 행을 쓴다
      // (예: 여름 배추가 미조사면 봄 배추 행으로 폴백)
      let item: FeedItem | null = null
      let usedRow: KamisDailyRow | null = null
      for (const row of rankCandidates(entry, rows)) {
        item = buildFeedItem(entry, row)
        if (item !== null) {
          usedRow = row
          break
        }
      }
      if (item === null) {
        missing.push(entry.id)
      } else {
        items.push(item)
        records.push({
          itemId: item.id,
          price: item.price,
          normalPrice: item.normalPrice,
          unit: item.unit,
          source: 'kamis',
          rawJson: usedRow === null ? null : JSON.stringify(usedRow),
        })
      }
    }
    return { feed: { items, asOf: regday, missing }, records }
  }

  /**
   * 최근 영업일부터 하루씩 거슬러 올라가며, 품목 커버리지가
   * 충분한(70% 이상) 첫 결과를 쓴다. 공휴일 연휴 대비.
   */
  async getFeed(now: Date = new Date()): Promise<KamisFeed> {
    if (this.cache && now.getTime() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.feed
    }

    let best: BuildResult | null = null
    const tried = new Set<string>()
    for (let offset = 0; offset < MAX_LOOKBACK_ATTEMPTS; offset++) {
      const regday = lastBusinessDay(now, offset)
      if (tried.has(regday)) continue
      tried.add(regday)

      const result = await this.buildForDate(regday)
      if (best === null || result.feed.items.length > best.feed.items.length) {
        best = result
      }
      if (result.feed.items.length >= ITEM_CATALOG.length * GOOD_ENOUGH_RATIO) {
        break
      }
    }

    // best는 루프에서 최소 1회 할당됨
    const { feed, records } = best as BuildResult
    this.persist(feed.asOf, records)
    this.cache = { feed, fetchedAt: now.getTime() }
    return feed
  }

  /** 수집 성공분을 이력 DB에 적재. 적재 실패가 API 응답을 막지는 않는다 */
  private persist(date: string, records: readonly PriceRecord[]): void {
    if (this.repository === null || records.length === 0) return
    try {
      this.repository.upsertMany(date, records)
    } catch (error: unknown) {
      this.logger.error({ err: error, date }, '가격 이력 적재 실패')
    }
  }
}
