import cors from '@fastify/cors'
import Fastify from 'fastify'
import { KamisClient } from './collector/kamis.js'
import { KamisFeedService } from './collector/kamis-feed.js'
import { PriceHistoryRepository, defaultDbPath } from './db/price-history.js'
import { registerPriceRoutes } from './routes/prices.js'

const DEFAULT_PORT = 3000

function loadDotEnv(): void {
  try {
    process.loadEnvFile()
  } catch {
    // .env가 없으면 환경 변수를 그대로 사용 (배포 환경 등)
  }
}

function buildFeedService(
  repository: PriceHistoryRepository,
  logger: { error(context: Record<string, unknown>, message: string): void },
): KamisFeedService | null {
  const certKey = process.env['KAMIS_CERT_KEY']
  const certId = process.env['KAMIS_CERT_ID']
  if (certKey === undefined || certKey === '' || certId === undefined || certId === '') {
    return null
  }
  return new KamisFeedService(
    new KamisClient({ certKey, certId }),
    repository,
    logger,
  )
}

async function main(): Promise<void> {
  loadDotEnv()

  const port = Number(process.env['PORT'] ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new RangeError(`PORT 환경 변수가 올바르지 않습니다: ${process.env['PORT']}`)
  }

  const app = Fastify({ logger: true })
  // 개발 편의를 위해 전체 허용. 배포 시 서비스 도메인으로 제한할 것.
  await app.register(cors, { origin: true })

  const repository = PriceHistoryRepository.open(defaultDbPath())
  const feedService = buildFeedService(repository, app.log)
  app.log.info(
    feedService === null
      ? 'KAMIS 자격 증명 없음 — 샘플 데이터로 서비스'
      : `KAMIS 피드 활성화 (1시간 캐시) · 이력 DB: ${defaultDbPath()}`,
  )
  registerPriceRoutes(app, feedService, repository)

  await app.listen({ port, host: '0.0.0.0' })

  // 콜드 캐시 방지: 시작 직후 + 30분마다 캐시를 미리 데운다.
  // KAMIS 순차 수집이 10초 이상 걸려, 요청 시점 수집은 클라이언트 타임아웃을 유발한다.
  if (feedService !== null) {
    const warm = async (): Promise<void> => {
      // 기본 지역 + 최근 요청된 지역을 순차 워밍 (KAMIS 부하 고려)
      for (const region of feedService.regionsToWarm()) {
        try {
          const feed = await feedService.getFeed(region)
          app.log.info(
            `피드 캐시 갱신(${region}): ${feed.asOf} 기준 ${feed.items.length}개`,
          )
        } catch (error: unknown) {
          app.log.error({ err: error, region }, '피드 캐시 갱신 실패')
        }
      }
    }
    void warm()
    setInterval(() => void warm(), 30 * 60 * 1000)
  }
}

main().catch((error) => {
  console.error('서버 시작 실패:', error)
  process.exit(1)
})
