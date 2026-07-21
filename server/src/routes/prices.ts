import type { FastifyInstance } from 'fastify'
import { deviationRate, judgeMovement, judgeVerdict } from '../domain/verdict.js'
import { SAMPLE_ITEMS } from '../data/sample-items.js'
import type { FeedItem, KamisFeedService } from '../collector/kamis-feed.js'
import {
  DEFAULT_REGION_CODE,
  ITEM_CATALOG,
  REGIONS,
  buildMilestones,
  isValidRegion,
} from '../collector/kamis-feed.js'
import type { PriceHistoryRepository } from '../db/price-history.js'

const CATEGORIES = ['채소', '과일', '축산', '수산', '곡물'] as const
const DEFAULT_HISTORY_DAYS = 90
const MAX_HISTORY_DAYS = 1095 // 3년

interface ItemsQuery {
  category?: string
  region?: string
}

interface HistoryQuery {
  days?: string
  region?: string
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

  app.get('/api/regions', async () => ({
    success: true,
    data: REGIONS,
    error: null,
    meta: { count: REGIONS.length, default: DEFAULT_REGION_CODE },
  }))

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
      const region = request.query.region ?? DEFAULT_REGION_CODE
      if (!isValidRegion(region)) {
        return reply.status(400).send({
          success: false,
          data: null,
          error: `지원하지 않는 지역 코드입니다: ${region}`,
        })
      }

      // 시점 비교(milestones)는 요청 지역의 최신 수집분에서,
      // 일일 이력은 기본 지역(서울) 적재분에서 가져온다.
      let rawJson: string | null = null
      let unit: string | null = null
      let normalPrice: number | null = null
      let milestonesAsOf: string | null = null

      if (region === DEFAULT_REGION_CODE || feedService === null) {
        const latest = historyRepository.getLatestRecord(id)
        rawJson = latest?.rawJson ?? null
        unit = latest?.unit ?? null
        normalPrice = latest?.normalPrice ?? null
        milestonesAsOf = latest?.date ?? null
      } else {
        try {
          const record = await feedService.getRecord(region, id)
          rawJson = record?.rawJson ?? null
          unit = record?.unit ?? null
          normalPrice = record?.normalPrice ?? null
          milestonesAsOf = (await feedService.getFeed(region)).asOf
        } catch (error) {
          request.log.error({ err: error, region }, '지역 시점 데이터 조회 실패')
        }
      }

      const rows =
        region === DEFAULT_REGION_CODE
          ? historyRepository.getHistory(id, days)
          : [] // 일일 이력은 서울 기준으로만 적재 중

      return {
        success: true,
        data: {
          unit,
          normalPrice,
          history: rows,
          // KAMIS 시점 데이터(1일전~1년전) — 일일 이력이 쌓이기 전에도 차트를 그릴 수 있게
          milestones: buildMilestones(rawJson),
          milestonesAsOf,
        },
        error: null,
        meta: { count: rows.length, days, region },
      }
    },
  )

  app.get<{ Querystring: ItemsQuery }>('/api/items', async (request, reply) => {
    const { category } = request.query
    const region = request.query.region ?? DEFAULT_REGION_CODE

    if (category !== undefined && !CATEGORIES.includes(category as never)) {
      return reply.status(400).send({
        success: false,
        data: null,
        error: `category는 ${CATEGORIES.join(', ')} 중 하나여야 합니다`,
      })
    }
    if (!isValidRegion(region)) {
      return reply.status(400).send({
        success: false,
        data: null,
        error: `지원하지 않는 지역 코드입니다: ${region}`,
      })
    }

    let items: readonly FeedItem[]
    let source: 'kamis' | 'sample'
    let asOf: string
    let missing: readonly string[] = []

    if (feedService !== null) {
      try {
        const feed = await feedService.getFeed(region)
        items = feed.items
        source = 'kamis'
        asOf = feed.asOf
        missing = feed.missing
        if (missing.length > 0) {
          request.log.warn({ missing, region }, 'KAMIS 가격 데이터 없는 품목 제외')
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

    const regionInfo = REGIONS.find((r) => r.code === region)
    return {
      success: true,
      data: filtered,
      error: null,
      meta: {
        asOf,
        source,
        count: filtered.length,
        missing,
        region: regionInfo,
      },
    }
  })
}
