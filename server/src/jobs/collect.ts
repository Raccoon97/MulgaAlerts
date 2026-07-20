/**
 * 일일 가격 수집 배치.
 * 크론 등록 예시 (평일 15시, KAMIS 당일 조사 발표 이후):
 *   0 15 * * 1-5  cd <repo>/server && npm run collect
 * API 서버와 동일한 수집·적재 경로를 쓰므로 서버가 떠 있지 않아도 이력이 쌓인다.
 */
import { KamisClient } from '../collector/kamis.js'
import { KamisFeedService } from '../collector/kamis-feed.js'
import { PriceHistoryRepository, defaultDbPath } from '../db/price-history.js'

async function main(): Promise<void> {
  try {
    process.loadEnvFile()
  } catch {
    // .env 없으면 환경 변수 사용
  }

  const certKey = process.env['KAMIS_CERT_KEY']
  const certId = process.env['KAMIS_CERT_ID']
  if (certKey === undefined || certKey === '' || certId === undefined || certId === '') {
    throw new Error('KAMIS_CERT_KEY / KAMIS_CERT_ID 환경 변수가 필요합니다')
  }

  const repository = PriceHistoryRepository.open(defaultDbPath())
  const service = new KamisFeedService(
    new KamisClient({ certKey, certId }),
    repository,
  )

  const feed = await service.getFeed()
  console.info(
    `수집 완료: ${feed.asOf} 기준 ${feed.items.length}개 적재` +
      (feed.missing.length > 0 ? `, 누락 ${feed.missing.join(', ')}` : ''),
  )
  console.info(`이력 DB: ${defaultDbPath()} · 최근 적재일: ${repository.latestDate()}`)
  repository.close()
}

main().catch((error: unknown) => {
  console.error('수집 실패:', error)
  process.exit(1)
})
