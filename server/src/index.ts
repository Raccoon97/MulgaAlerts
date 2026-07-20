import cors from '@fastify/cors'
import Fastify from 'fastify'
import { KamisClient } from './collector/kamis.js'
import { KamisFeedService } from './collector/kamis-feed.js'
import { registerPriceRoutes } from './routes/prices.js'

const DEFAULT_PORT = 3000

function loadDotEnv(): void {
  try {
    process.loadEnvFile()
  } catch {
    // .env가 없으면 환경 변수를 그대로 사용 (배포 환경 등)
  }
}

function buildFeedService(): KamisFeedService | null {
  const certKey = process.env['KAMIS_CERT_KEY']
  const certId = process.env['KAMIS_CERT_ID']
  if (certKey === undefined || certKey === '' || certId === undefined || certId === '') {
    return null
  }
  return new KamisFeedService(new KamisClient({ certKey, certId }))
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

  const feedService = buildFeedService()
  app.log.info(
    feedService === null
      ? 'KAMIS 자격 증명 없음 — 샘플 데이터로 서비스'
      : 'KAMIS 피드 활성화 (1시간 캐시)',
  )
  registerPriceRoutes(app, feedService)

  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error('서버 시작 실패:', error)
  process.exit(1)
})
