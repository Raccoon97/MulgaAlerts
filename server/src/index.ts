import cors from '@fastify/cors'
import Fastify from 'fastify'
import { registerPriceRoutes } from './routes/prices.js'

const DEFAULT_PORT = 3000

async function main(): Promise<void> {
  const port = Number(process.env['PORT'] ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new RangeError(`PORT 환경 변수가 올바르지 않습니다: ${process.env['PORT']}`)
  }

  const app = Fastify({ logger: true })
  // 개발 편의를 위해 전체 허용. 배포 시 서비스 도메인으로 제한할 것.
  await app.register(cors, { origin: true })
  registerPriceRoutes(app)

  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error('서버 시작 실패:', error)
  process.exit(1)
})
