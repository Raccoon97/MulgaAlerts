import { describe, expect, test } from 'vitest'
import { PriceHistoryRepository } from '../src/db/price-history.js'

function makeRepo(): PriceHistoryRepository {
  return PriceHistoryRepository.open(':memory:')
}

const sampleRecord = {
  itemId: 'egg',
  price: 7345,
  normalPrice: 6830,
  unit: '30구',
  source: 'kamis',
  rawJson: null,
}

describe('PriceHistoryRepository', () => {
  test('적재한 이력을 날짜 오름차순으로 조회한다', () => {
    const repo = makeRepo()
    repo.upsertMany('2026-07-16', [{ ...sampleRecord, price: 7300 }])
    repo.upsertMany('2026-07-17', [sampleRecord])

    const history = repo.getHistory('egg', 30)
    expect(history).toHaveLength(2)
    expect(history[0]?.date).toBe('2026-07-16')
    expect(history[0]?.price).toBe(7300)
    expect(history[1]?.date).toBe('2026-07-17')
    expect(history[1]?.price).toBe(7345)
  })

  test('같은 (날짜, 품목) 재적재 시 덮어쓴다 (중복 없음)', () => {
    const repo = makeRepo()
    repo.upsertMany('2026-07-17', [sampleRecord])
    repo.upsertMany('2026-07-17', [{ ...sampleRecord, price: 7400 }])

    const history = repo.getHistory('egg', 30)
    expect(history).toHaveLength(1)
    expect(history[0]?.price).toBe(7400)
  })

  test('days 파라미터로 조회 범위를 제한한다', () => {
    const repo = makeRepo()
    repo.upsertMany('2026-06-01', [sampleRecord])
    repo.upsertMany('2026-07-17', [sampleRecord])

    // 기준일(2026-07-18)에서 30일 이내만
    const history = repo.getHistory('egg', 30, new Date('2026-07-18'))
    expect(history).toHaveLength(1)
    expect(history[0]?.date).toBe('2026-07-17')
  })

  test('다른 품목의 이력은 섞이지 않는다', () => {
    const repo = makeRepo()
    repo.upsertMany('2026-07-17', [
      sampleRecord,
      { ...sampleRecord, itemId: 'onion', price: 1502, unit: '1kg' },
    ])

    expect(repo.getHistory('egg', 30)).toHaveLength(1)
    expect(repo.getHistory('onion', 30)).toHaveLength(1)
    expect(repo.getHistory('rice', 30)).toHaveLength(0)
  })

  test('latestDate는 가장 최근 적재 날짜를 반환한다', () => {
    const repo = makeRepo()
    expect(repo.latestDate()).toBeNull()
    repo.upsertMany('2026-07-16', [sampleRecord])
    repo.upsertMany('2026-07-17', [sampleRecord])
    expect(repo.latestDate()).toBe('2026-07-17')
  })

  test('잘못된 날짜 형식은 에러를 던진다', () => {
    const repo = makeRepo()
    expect(() => repo.upsertMany('2026/07/17', [sampleRecord])).toThrow()
    expect(() => repo.upsertMany('내일', [sampleRecord])).toThrow()
  })

  test('getLatestRecord는 가장 최근 레코드(raw_json 포함)를 반환한다', () => {
    const repo = makeRepo()
    expect(repo.getLatestRecord('egg')).toBeNull()

    repo.upsertMany('2026-07-16', [
      { ...sampleRecord, price: 7300, rawJson: '{"today":7300}' },
    ])
    repo.upsertMany('2026-07-17', [
      { ...sampleRecord, rawJson: '{"today":7345}' },
    ])

    const latest = repo.getLatestRecord('egg')
    expect(latest?.date).toBe('2026-07-17')
    expect(latest?.price).toBe(7345)
    expect(latest?.rawJson).toBe('{"today":7345}')
  })
})
