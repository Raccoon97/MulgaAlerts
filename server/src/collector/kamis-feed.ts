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
 * KAMIS 소매가 조사 도시 (2026-07 실측으로 데이터 제공 확인).
 * 시·군 전체가 아니라 조사 대상 도시만 지원된다.
 * 축산 등 일부 품목은 전국 단일가라 지역 간 차이가 없다.
 */
export interface Region {
  readonly code: string
  readonly name: string
}

export const DEFAULT_REGION_CODE = '1101'

// 2026-07-21 채소(200) 카테고리 실측으로 농수산물 데이터 제공 확인된 도시.
// 성남·의정부 등은 축산(전국 단일가)만 나와 제외했다.
export const REGIONS: readonly Region[] = [
  { code: '1101', name: '서울' },
  { code: '2300', name: '인천' },
  { code: '3111', name: '수원' },
  { code: '3138', name: '고양' },
  { code: '3145', name: '용인' },
  { code: '2100', name: '부산' },
  { code: '2200', name: '대구' },
  { code: '2501', name: '대전' },
  { code: '2401', name: '광주' },
  { code: '2601', name: '울산' },
  { code: '2701', name: '세종' },
  { code: '3211', name: '춘천' },
  { code: '3214', name: '강릉' },
  { code: '3311', name: '청주' },
  { code: '3411', name: '천안' },
  { code: '3511', name: '전주' },
  { code: '3613', name: '순천' },
  { code: '3711', name: '포항' },
  { code: '3714', name: '안동' },
  { code: '3814', name: '창원' },
  { code: '3911', name: '제주' },
]

export function isValidRegion(code: string): boolean {
  return REGIONS.some((region) => region.code === code)
}

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
  // ── 확장 품목 (2026-07 실측 코드) ──
  { id: 'sweet-potato', name: '고구마', category: '채소', kamisCategory: '100', itemCode: '151', kindCodes: ['00'], rankCodes: ['04', '05'] },
  { id: 'spinach', name: '시금치', category: '채소', kamisCategory: '200', itemCode: '213', kindCodes: ['00'], rankCodes: ['04'] },
  { id: 'cabbage-round', name: '양배추', category: '채소', kamisCategory: '200', itemCode: '212', kindCodes: ['00'], rankCodes: ['04', '05'] },
  { id: 'carrot', name: '당근', category: '채소', kamisCategory: '200', itemCode: '232', kindCodes: ['01'], rankCodes: ['04', '05'] },
  { id: 'perilla-leaf', name: '깻잎', category: '채소', kamisCategory: '200', itemCode: '253', kindCodes: ['00'], rankCodes: ['04'] },
  { id: 'green-pepper', name: '풋고추', category: '채소', kamisCategory: '200', itemCode: '242', kindCodes: ['00', '02'], rankCodes: ['04', '05'] },
  { id: 'garlic', name: '마늘', category: '채소', kamisCategory: '200', itemCode: '258', kindCodes: ['01'], rankCodes: ['04', '05'] },
  { id: 'paprika', name: '파프리카', category: '채소', kamisCategory: '200', itemCode: '256', kindCodes: ['00'], rankCodes: ['04', '05'] },
  { id: 'broccoli', name: '브로콜리', category: '채소', kamisCategory: '200', itemCode: '280', kindCodes: ['00'], rankCodes: ['04'] },
  { id: 'oyster-mushroom', name: '느타리버섯', category: '채소', kamisCategory: '300', itemCode: '315', kindCodes: ['00', '01'], rankCodes: ['04'] },
  { id: 'king-oyster', name: '새송이버섯', category: '채소', kamisCategory: '300', itemCode: '317', kindCodes: ['00'], rankCodes: ['04', '05'] },
  { id: 'cherry-tomato', name: '방울토마토', category: '과일', kamisCategory: '200', itemCode: '422', kindCodes: ['01', '02'], rankCodes: ['04'] },
  { id: 'korean-melon', name: '참외', category: '과일', kamisCategory: '200', itemCode: '222', kindCodes: ['00'], rankCodes: ['04', '05'] },
  { id: 'pear', name: '배', category: '과일', kamisCategory: '400', itemCode: '412', kindCodes: ['01'], rankCodes: ['04', '05'] },
  { id: 'peach', name: '복숭아', category: '과일', kamisCategory: '400', itemCode: '413', kindCodes: ['01'], rankCodes: ['04', '05'] },
  { id: 'grape', name: '포도', category: '과일', kamisCategory: '400', itemCode: '414', kindCodes: ['01', '02'], rankCodes: ['24', '25'] },
  { id: 'orange', name: '오렌지', category: '과일', kamisCategory: '400', itemCode: '421', kindCodes: ['06'], rankCodes: ['05', '04'] },
  { id: 'kiwi', name: '키위', category: '과일', kamisCategory: '400', itemCode: '419', kindCodes: ['02'], rankCodes: ['04', '05'] },
  { id: 'beef-sirloin', name: '한우 등심', category: '축산', kamisCategory: '500', itemCode: '4301', kindCodes: ['22'], rankCodes: ['02', '01', '03'] },
  { id: 'pork-neck', name: '목살', category: '축산', kamisCategory: '500', itemCode: '4304', kindCodes: ['68'], rankCodes: ['00'] },
  { id: 'milk', name: '우유', category: '축산', kamisCategory: '500', itemCode: '9908', kindCodes: ['01'], rankCodes: ['00'] },
  { id: 'hairtail', name: '갈치', category: '수산', kamisCategory: '600', itemCode: '613', kindCodes: ['03'], rankCodes: ['21', '20', '22'] },
  { id: 'laver', name: '김', category: '수산', kamisCategory: '600', itemCode: '641', kindCodes: ['00', '01'], rankCodes: ['30'] },
  { id: 'shrimp', name: '새우', category: '수산', kamisCategory: '600', itemCode: '654', kindCodes: ['01'], rankCodes: ['30'] },
  { id: 'anchovy', name: '멸치', category: '수산', kamisCategory: '600', itemCode: '638', kindCodes: ['00'], rankCodes: ['28', '27', '29'] },
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

/** 상세 차트용 시점 포인트 (KAMIS가 제공하는 과거 시점 가격) */
export interface MilestonePoint {
  readonly label: string
  readonly daysAgo: number
  readonly price: number
}

/** 저장된 raw_json(KamisDailyRow)에서 시점 포인트를 추출 */
export function buildMilestones(rawJson: string | null): readonly MilestonePoint[] {
  if (rawJson === null) return []
  let row: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(rawJson)
    if (typeof parsed !== 'object' || parsed === null) return []
    row = parsed as Record<string, unknown>
  } catch {
    return []
  }
  const candidates: ReadonlyArray<[keyof KamisDailyRow, string, number]> = [
    ['today', '당일', 0],
    ['dayAgo', '1일전', 1],
    ['weekAgo', '1주일전', 7],
    ['monthAgo', '1개월전', 30],
    ['yearAgo', '1년전', 365],
  ]
  const points: MilestonePoint[] = []
  for (const [key, label, daysAgo] of candidates) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      points.push({ label, daysAgo, price: value })
    }
  }
  return points
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1시간 — KAMIS는 일 단위 데이터
const REGION_REFRESH_MS = 6 * 60 * 60 * 1000 // 비기본 지역 사전 워밍 주기
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
  private readonly cacheByRegion = new Map<
    string,
    { result: BuildResult; fetchedAt: number }
  >()

  /** 워밍 대상: 최근 요청된 지역 (기본 지역은 항상 포함) */
  private readonly activeRegions = new Map<string, number>()

  constructor(
    private readonly client: KamisClient,
    private readonly repository: PriceHistoryRepository | null = null,
    private readonly logger: FeedLogger = console,
  ) {}

  private async buildForDate(
    regday: string,
    regionCode: string,
  ): Promise<BuildResult> {
    const categories = [...new Set(ITEM_CATALOG.map((e) => e.kamisCategory))]
    // 카테고리 6종을 병렬 조회 — 순차(10초+) 대비 2~3초로 단축
    const results = await Promise.all(
      categories.map(async (category) => ({
        category,
        rows: await this.client.fetchDailyPricesByCategory(
          category,
          regday,
          regionCode,
        ),
      })),
    )
    const rowsByCategory = new Map<string, readonly KamisDailyRow[]>(
      results.map((r) => [r.category, r.rows]),
    )

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
   * 지역별로 별도 캐시(1시간)를 유지한다.
   */
  async getFeed(
    regionCode: string = DEFAULT_REGION_CODE,
    now: Date = new Date(),
  ): Promise<KamisFeed> {
    this.activeRegions.set(regionCode, now.getTime())

    // 비기본 지역은 워밍 주기(6시간)와 맞춰 캐시를 더 오래 신뢰한다
    const maxAge =
      regionCode === DEFAULT_REGION_CODE ? CACHE_TTL_MS : REGION_REFRESH_MS
    const cached = this.cacheByRegion.get(regionCode)
    if (cached && now.getTime() - cached.fetchedAt < maxAge) {
      return cached.result.feed
    }

    let best: BuildResult | null = null
    const tried = new Set<string>()
    for (let offset = 0; offset < MAX_LOOKBACK_ATTEMPTS; offset++) {
      const regday = lastBusinessDay(now, offset)
      if (tried.has(regday)) continue
      tried.add(regday)

      const result = await this.buildForDate(regday, regionCode)
      if (best === null || result.feed.items.length > best.feed.items.length) {
        best = result
      }
      if (result.feed.items.length >= ITEM_CATALOG.length * GOOD_ENOUGH_RATIO) {
        break
      }
    }

    // best는 루프에서 최소 1회 할당됨
    const result = best as BuildResult
    // 일일 이력 적재는 기본 지역(서울) 기준으로만 유지한다
    if (regionCode === DEFAULT_REGION_CODE) {
      this.persist(result.feed.asOf, result.records)
    }
    this.cacheByRegion.set(regionCode, { result, fetchedAt: now.getTime() })
    return result.feed
  }

  /** 지역별 최신 수집분에서 품목의 원본 행(raw) 조회 — 상세 시점 비교용 */
  async getRecord(
    regionCode: string,
    itemId: string,
  ): Promise<PriceRecord | null> {
    await this.getFeed(regionCode)
    const cached = this.cacheByRegion.get(regionCode)
    return cached?.result.records.find((r) => r.itemId === itemId) ?? null
  }

  /**
   * 워밍 대상 지역. 어느 지역을 열어도 즉시 뜨도록 전 지역을 미리 수집한다.
   * 가격은 하루 한 번(15시경)만 바뀌므로:
   * - 기본 지역(서울): 캐시 만료(1시간) 시마다
   * - 그 외 지역: 6시간 이상 지났을 때만 (KAMIS 부하 절제)
   */
  regionsToWarm(now: Date = new Date()): readonly string[] {
    const stale = (code: string, maxAgeMs: number): boolean => {
      const cached = this.cacheByRegion.get(code)
      return !cached || now.getTime() - cached.fetchedAt >= maxAgeMs
    }
    return REGIONS.map((r) => r.code).filter((code) =>
      code === DEFAULT_REGION_CODE
        ? stale(code, CACHE_TTL_MS)
        : stale(code, REGION_REFRESH_MS),
    )
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
