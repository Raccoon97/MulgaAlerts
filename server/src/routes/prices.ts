import type { FastifyInstance } from 'fastify'
import { deviationRate, judgeMovement, judgeVerdict } from '../domain/verdict.js'
import { SAMPLE_ITEMS } from '../data/sample-items.js'
import type { FeedItem, KamisFeedService } from '../collector/kamis-feed.js'
import { ITEM_CATALOG } from '../collector/kamis-feed.js'
import type { PriceHistoryRepository } from '../db/price-history.js'

const CATEGORIES = ['채소', '과일', '축산', '수산', '곡물'] as const
const DEFAULT_HISTORY_DAYS = 90
const MAX_HISTORY_DAYS = 1095 // 3년

interface ItemsQuery {
  category?: string
}

interface HistoryQuery {
  days?: string
}

interface HistoryParams {
  id: string
}

function sampleFeedItems(): readonly FeedItem[] {
  return SAMPLE_ITEMS.map((item) => ({
    ...item,
    deviationRate: deviationRate(item.price, item.normalPrice),
    verdict: judgeVerdict(item.price, item.normalPrice),
    movement: judgeMovement(item.price, item.prevPrice),
  }))
}

/**
 * 가격 조회 API.
 * KAMIS 피드 서비스가 주어지면 실데이터(서울 소매가, 평년가 기준 판정)로 응답하고,
 * 없거나 실패하면 샘플 데이터로 폴백한다. meta.source로 출처를 명시한다.
 */
export function registerPriceRoutes(
  app: FastifyInstance,
  feedService: KamisFeedService | null = null,
  historyRepository: PriceHistoryRepository | null = null,
): void {
  app.get('/api/health', async () => ({ ok: true }))

  app.get<{ Params: HistoryParams; Querystring: HistoryQuery }>(
    '/api/items/:id/history',
    async (request, reply) => {
      if (historyRepository === null) {
        return reply.status(503).send({
          success: false,
          data: null,
          error: '가격 이력 저장소가 설정되지 않았습니다',
        })
      }
      const { id } = request.params
      if (!ITEM_CATALOG.some((entry) => entry.id === id)) {
        return reply.status(404).send({
          success: false,
          data: null,
          error: `알 수 없는 품목입니다: ${id}`,
        })
      }
      const days = Number(request.query.days ?? DEFAULT_HISTORY_DAYS)
      if (!Number.isInteger(days) || days <= 0 || days > MAX_HISTORY_DAYS) {
        return reply.status(400).send({
          success: false,
          data: null,
          error: `days는 1~${MAX_HISTORY_DAYS} 사이의 정수여야 합니다`,
        })
      }
      const rows = historyRepository.getHistory(id, days)
      return {
        success: true,
        data: rows,
        error: null,
        meta: { count: rows.length, days },
      }
    },
  )

  app.get<{ Querystring: ItemsQuery }>('/api/items', async (request, reply) => {
    const { category } = request.query

    if (category !== undefined && !CATEGORIES.includes(category as never)) {
      return reply.status(400).send({
        success: false,
        data: null,
        error: `category는 ${CATEGORIES.join(', ')} 중 하나여야 합니다`,
      })
    }

    let items: readonly FeedItem[]
    let source: 'kamis' | 'sample'
    let asOf: string
    let missing: readonly string[] = []

    if (feedService !== null) {
      try {
        const feed = await feedService.getFeed()
        items = feed.items
        source = 'kamis'
        asOf = feed.asOf
        missing = feed.missing
        if (missing.length > 0) {
          request.log.warn({ missing }, 'KAMIS 가격 데이터 없는 품목 제외')
        }
      } catch (error) {
        request.log.error({ err: error }, 'KAMIS 조회 실패 — 샘플 데이터로 폴백')
        items = sampleFeedItems()
        source = 'sample'
        asOf = new Date().toISOString().slice(0, 10)
      }
    } else {
      items = sampleFeedItems()
      source = 'sample'
      asOf = new Date().toISOString().slice(0, 10)
    }

    const filtered = items.filter(
      (item) => category === undefined || item.category === category,
    )

    return {
      success: true,
      data: filtered,
      error: null,
      meta: { asOf, source, count: filtered.length, missing },
    }
  })
}
