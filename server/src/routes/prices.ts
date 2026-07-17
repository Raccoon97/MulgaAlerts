import type { FastifyInstance } from 'fastify'
import { deviationRate, judgeMovement, judgeVerdict } from '../domain/verdict.js'
import { SAMPLE_ITEMS } from '../data/sample-items.js'

const CATEGORIES = ['채소', '과일', '축산', '수산', '곡물'] as const

interface ItemsQuery {
  category?: string
}

/**
 * 가격 조회 API.
 * KAMIS 키 발급 전까지는 샘플 데이터를 판정 로직에 통과시켜 응답한다.
 * meta.source로 데이터 출처(sample | kamis)를 명시해 클라이언트가 구분할 수 있게 한다.
 */
export function registerPriceRoutes(app: FastifyInstance): void {
  app.get('/api/health', async () => ({ ok: true }))

  app.get<{ Querystring: ItemsQuery }>('/api/items', async (request, reply) => {
    const { category } = request.query

    if (category !== undefined && !CATEGORIES.includes(category as never)) {
      return reply.status(400).send({
        success: false,
        data: null,
        error: `category는 ${CATEGORIES.join(', ')} 중 하나여야 합니다`,
      })
    }

    const items = SAMPLE_ITEMS
      .filter((item) => category === undefined || item.category === category)
      .map((item) => ({
        ...item,
        deviationRate: deviationRate(item.price, item.normalPrice),
        verdict: judgeVerdict(item.price, item.normalPrice),
        movement: judgeMovement(item.price, item.prevPrice),
      }))

    return {
      success: true,
      data: items,
      error: null,
      meta: {
        asOf: new Date().toISOString().slice(0, 10),
        source: 'sample',
        count: items.length,
      },
    }
  })
}
