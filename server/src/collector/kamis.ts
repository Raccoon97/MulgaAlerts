/**
 * KAMIS(농수산물유통정보) OpenAPI 클라이언트 — 뼈대.
 *
 * 실제 요청 파라미터·응답 스키마는 API 키 발급 후 실측으로 확정한다.
 * 그 전까지 fetchDailyPrices는 명시적 에러를 던진다 (조용한 실패 금지).
 *
 * 참고: KAMIS OpenAPI는 p_cert_key / p_cert_id 인증 파라미터를 사용하며
 * action별 엔드포인트(예: dailyPriceByCategoryList)를 제공한다.
 */

export interface KamisCredentials {
  readonly certKey: string
  readonly certId: string
}

export interface DailyPrice {
  readonly itemCode: string
  readonly itemName: string
  readonly unit: string
  /** YYYY-MM-DD */
  readonly date: string
  /** 가격 미조사(-) 품목은 null */
  readonly price: number | null
  readonly region: string
}

export const KAMIS_BASE_URL = 'https://www.kamis.or.kr/service/price/xml.do'

export class KamisClient {
  constructor(
    private readonly credentials: KamisCredentials,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** 일일 가격 조회 URL 구성. 파라미터 명세는 키 발급 후 실측으로 검증한다. */
  buildDailyPriceUrl(action: string, params: Readonly<Record<string, string>>): URL {
    const url = new URL(KAMIS_BASE_URL)
    url.searchParams.set('action', action)
    url.searchParams.set('p_cert_key', this.credentials.certKey)
    url.searchParams.set('p_cert_id', this.credentials.certId)
    url.searchParams.set('p_returntype', 'json')
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    return url
  }

  async fetchDailyPrices(_date: string): Promise<readonly DailyPrice[]> {
    void this.fetchFn
    throw new Error(
      'KAMIS 연동은 API 키 발급 후 응답 스키마 실측과 함께 구현합니다. ' +
        '그 전까지는 sample-items 데이터를 사용하세요.',
    )
  }
}
