/**
 * KAMIS(농수산물유통정보) OpenAPI 클라이언트.
 *
 * 실측(2026-07)으로 확인한 dailyPriceByCategoryList 응답 형태:
 * - { condition: [...], data: { error_code: "000", item: [...] } }
 * - item 행: item_name, item_code, kind_name, kind_code, rank, rank_code, unit,
 *   day1~day7 라벨과 dpr1~dpr7 가격(콤마 포함 문자열)
 * - dpr1=당일, dpr2=1일전, dpr3=1주일전, dpr4=2주일전, dpr5=1개월전,
 *   dpr6=1년전, dpr7=일평년.  미조사 값은 "-" 또는 "0".
 * - 기본 UA로 호출하면 응답이 오지 않으므로 브라우저 UA 헤더가 필요하고,
 *   http → https 302 리다이렉트를 따라가야 한다.
 */

export interface KamisCredentials {
  readonly certKey: string
  readonly certId: string
}

export interface KamisDailyRow {
  readonly itemCode: string
  readonly itemName: string
  readonly kindCode: string
  readonly kindName: string
  readonly rankCode: string
  readonly unit: string
  /** 당일 가격. 미조사면 null */
  readonly today: number | null
  /** 1일전 가격 */
  readonly dayAgo: number | null
  /** 1주일전 가격 */
  readonly weekAgo: number | null
  /** 1개월전 가격 */
  readonly monthAgo: number | null
  /** 1년전 가격 */
  readonly yearAgo: number | null
  /** 일평년 가격 — 판정 기준선 */
  readonly normalYear: number | null
}

export const KAMIS_BASE_URL = 'https://www.kamis.or.kr/service/price/xml.do'

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 60_000

export class KamisApiError extends Error {}

/** "3,335" → 3335. 미조사("-", "0", 빈 값)는 null */
export function parseKamisPrice(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replaceAll(',', '').trim()
  if (cleaned === '' || cleaned === '-' || cleaned === '0') return null
  const value = Number(cleaned)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** 응답 JSON을 행 배열로 변환. 형태가 예상과 다르면 KamisApiError */
export function parseDailyPriceResponse(body: unknown): readonly KamisDailyRow[] {
  if (typeof body !== 'object' || body === null) {
    throw new KamisApiError('KAMIS 응답이 객체가 아닙니다')
  }
  const data = (body as Record<string, unknown>)['data']
  if (typeof data !== 'object' || data === null) {
    // 인증 실패 시 data가 ["901"] 같은 배열로 오는 경우가 있다
    throw new KamisApiError(`KAMIS data 형식 오류: ${JSON.stringify(data)}`)
  }
  const errorCode = (data as Record<string, unknown>)['error_code']
  if (errorCode !== '000') {
    throw new KamisApiError(`KAMIS error_code: ${String(errorCode)}`)
  }
  const items = (data as Record<string, unknown>)['item']
  if (!Array.isArray(items)) {
    throw new KamisApiError('KAMIS item 목록이 배열이 아닙니다')
  }
  return items.map((row) => {
    const r = row as Record<string, unknown>
    return {
      itemCode: String(r['item_code'] ?? ''),
      itemName: String(r['item_name'] ?? ''),
      kindCode: String(r['kind_code'] ?? ''),
      kindName: String(r['kind_name'] ?? ''),
      rankCode: String(r['rank_code'] ?? ''),
      unit: String(r['unit'] ?? ''),
      today: parseKamisPrice(r['dpr1']),
      dayAgo: parseKamisPrice(r['dpr2']),
      weekAgo: parseKamisPrice(r['dpr3']),
      monthAgo: parseKamisPrice(r['dpr5']),
      yearAgo: parseKamisPrice(r['dpr6']),
      normalYear: parseKamisPrice(r['dpr7']),
    }
  })
}

export class KamisClient {
  constructor(
    private readonly credentials: KamisCredentials,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  buildDailyPriceUrl(
    categoryCode: string,
    regday: string,
    regionCode: string,
  ): URL {
    const url = new URL(KAMIS_BASE_URL)
    url.searchParams.set('action', 'dailyPriceByCategoryList')
    url.searchParams.set('p_cert_key', this.credentials.certKey)
    url.searchParams.set('p_cert_id', this.credentials.certId)
    url.searchParams.set('p_returntype', 'json')
    url.searchParams.set('p_product_cls_code', '01') // 소매
    url.searchParams.set('p_item_category_code', categoryCode)
    url.searchParams.set('p_country_code', regionCode) // 조사 도시 (전국 평균은 미제공)
    url.searchParams.set('p_regday', regday)
    url.searchParams.set('p_convert_kg_yn', 'N')
    return url
  }

  /** 카테고리(100/200/300/400/500/600) 일일 소매가 조회 */
  async fetchDailyPricesByCategory(
    categoryCode: string,
    regday: string,
    regionCode: string,
  ): Promise<readonly KamisDailyRow[]> {
    const url = this.buildDailyPriceUrl(categoryCode, regday, regionCode)
    const response = await this.fetchFn(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new KamisApiError(`KAMIS HTTP ${response.status}`)
    }
    return parseDailyPriceResponse(await response.json())
  }
}
