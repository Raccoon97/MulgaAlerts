/**
 * 한국소비자원 참가격 — 지역 매장 실판매가 수집기.
 *
 * 공공데이터포털 파일변환 API(namespace 15083256, 2026-07 실측):
 * - Swagger(https://infuser.odcloud.kr/oas/docs?namespace=15083256/v1)에
 *   월별 파일 엔드포인트가 나열되며, summary의 _YYYYMMDD로 최신본을 고른다.
 * - 행 필드: 상품명, 조사일(YYYY-MM-DD), 판매가격, 판매업소, 제조사, 세일여부
 * - 월 1회 등록(격주 조사 포함)이라 최대 수 주 지연 —
 *   "오늘 판정"이 아닌 "동네 매장 실판매가 참고" 용도로만 쓴다.
 */

export interface LocalPriceRow {
  readonly itemId: string
  readonly product: string
  readonly store: string
  readonly price: number
  /** YYYY-MM-DD */
  readonly surveyDate: string
}

/** 우리 품목 ↔ 참가격 상품명 매핑 (2026-06 파일 실측 상품명) */
export const LOCAL_PRODUCT_MAP: ReadonlyMap<string, readonly string[]> =
  new Map([
    ['cabbage', ['배추(1.5~2kg)']],
    ['onion', ['양파(껍질 있는 망포장, 1.5kg)']],
    ['potato', ['감자(껍질 있는 감자, 100g)']],
    ['sweet-potato', ['고구마(껍질 있는 밤고구마, 100g)', '고구마(껍질 있는 호박고구마, 100g)']],
    ['green-onion', ['대파(흙대파, 500~800g)']],
    ['oyster-mushroom', ['느타리버섯(100g)']],
    ['pork-belly', ['돼지고기 삼겹살(100g)']],
    ['pork-neck', ['돼지고기 목살(100g)']],
    ['egg', ['CJ 1등급 깨끗한 계란(15개)', 'CJ 1등급 깨끗한 계란(10개)']],
    ['milk', ['남양유업 맛있는우유GT(900ml)', '남양 아인슈타인 무항생제 우유(900ml)']],
    ['mackerel', ['고등어(생물, 300~500g)']],
    ['hairtail', ['갈치(생물, 100g)', '갈치(냉동, 100g)']],
    ['squid', ['오징어(생물, 200~300g)', '오징어(냉동, 200~300g)']],
    ['shrimp', ['흰다리새우(100g)']],
  ])

/**
 * 도시명 → 판매업소명 검색 키워드.
 * 지점명에 도시명이 그대로 들어가는 경우가 대부분이고,
 * 신도시·구도심 별칭만 보강한다.
 */
export const CITY_STORE_ALIASES: ReadonlyMap<string, readonly string[]> =
  new Map([
    // 서울 지점은 자치구·동명으로 표기됨 — 서울에만 있는 확실한 지명만 나열
    [
      '서울',
      [
        '서울', '강남', '서초', '송파', '잠실', '목동', '마포', '상암',
        '용산', '영등포', '노원', '은평', '양재', '창동', '신촌', '성수',
        '왕십리', '청량리', '관악', '동작', '강동', '강북', '도봉', '중랑',
        '금천', '낙성대', '동소문',
      ],
    ],
    ['성남', ['성남', '분당', '판교']],
    ['고양', ['고양', '일산', '능곡']],
    ['화성', ['화성', '동탄', '봉담']],
    ['용인', ['용인', '수지', '기흥']],
    ['창원', ['창원', '마산', '진해']],
    ['안산', ['안산']],
  ])

export function storeKeywordsForCity(city: string): readonly string[] {
  return CITY_STORE_ALIASES.get(city) ?? [city]
}

const SWAGGER_URL = 'https://infuser.odcloud.kr/oas/docs?namespace=15083256/v1'
const API_BASE = 'https://api.odcloud.kr/api'
const PAGE_SIZE = 5000
const REQUEST_TIMEOUT_MS = 60_000

export class ChamgagyeokError extends Error {}

interface SwaggerDoc {
  readonly paths?: Record<string, { get?: { summary?: string } }>
}

/** Swagger 문서에서 가장 최신 월 파일 경로를 고른다 */
export function pickLatestPath(doc: SwaggerDoc): string {
  let best: { date: string; path: string } | null = null
  for (const [path, spec] of Object.entries(doc.paths ?? {})) {
    const summary = spec.get?.summary ?? ''
    const match = /_(\d{8})/.exec(summary)
    if (match?.[1] !== undefined && (best === null || match[1] > best.date)) {
      best = { date: match[1], path }
    }
  }
  if (best === null) {
    throw new ChamgagyeokError('참가격 Swagger에서 파일 경로를 찾지 못했습니다')
  }
  return best.path
}

/** 원시 행에서 매핑 품목만 골라 LocalPriceRow로 변환 */
export function matchRow(raw: Record<string, unknown>): LocalPriceRow | null {
  const product = raw['상품명']
  const store = raw['판매업소']
  const price = raw['판매가격']
  const surveyDate = raw['조사일']
  if (
    typeof product !== 'string' ||
    typeof store !== 'string' ||
    typeof surveyDate !== 'string' ||
    typeof price !== 'number' ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null
  }
  for (const [itemId, products] of LOCAL_PRODUCT_MAP) {
    if (products.includes(product)) {
      return { itemId, product, store, price, surveyDate }
    }
  }
  return null
}

export class ChamgagyeokClient {
  constructor(
    private readonly serviceKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async fetchJson(url: string): Promise<unknown> {
    const response = await this.fetchFn(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new ChamgagyeokError(`참가격 HTTP ${response.status}`)
    }
    return response.json()
  }

  /** 최신 월 파일 전체를 페이지 순회하며 매핑 품목 행만 수집 */
  async fetchLatestLocalPrices(): Promise<readonly LocalPriceRow[]> {
    const doc = (await this.fetchJson(SWAGGER_URL)) as SwaggerDoc
    const path = pickLatestPath(doc)

    const rows: LocalPriceRow[] = []
    let page = 1
    for (;;) {
      const params = new URLSearchParams({
        serviceKey: this.serviceKey,
        page: String(page),
        perPage: String(PAGE_SIZE),
      })
      const body = (await this.fetchJson(
        `${API_BASE}${path}?${params.toString()}`,
      )) as {
        data?: Array<Record<string, unknown>>
        matchCount?: number
      }
      const data = body.data ?? []
      for (const raw of data) {
        const row = matchRow(raw)
        if (row !== null) rows.push(row)
      }
      const total = body.matchCount ?? 0
      if (data.length === 0 || page * PAGE_SIZE >= total) break
      page += 1
    }
    return rows
  }
}
