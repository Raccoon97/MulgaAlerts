import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  KamisApiError,
  parseDailyPriceResponse,
  parseKamisPrice,
} from '../src/collector/kamis.js'
import {
  ITEM_CATALOG,
  buildFeedItem,
  buildMilestones,
  pickRow,
} from '../src/collector/kamis-feed.js'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'kamis-cat-500.json',
)
const fixture: unknown = JSON.parse(readFileSync(fixturePath, 'utf-8'))

describe('parseKamisPrice', () => {
  test('콤마 포함 가격 문자열을 숫자로 변환한다', () => {
    expect(parseKamisPrice('3,335')).toBe(3335)
    expect(parseKamisPrice('60,475')).toBe(60475)
    expect(parseKamisPrice('943')).toBe(943)
  })

  test('미조사 값("-", "0", 빈 문자열)은 null을 반환한다', () => {
    expect(parseKamisPrice('-')).toBeNull()
    expect(parseKamisPrice('0')).toBeNull()
    expect(parseKamisPrice('')).toBeNull()
    expect(parseKamisPrice(undefined)).toBeNull()
  })
})

describe('parseDailyPriceResponse', () => {
  test('실측 픽스처를 행 배열로 변환한다', () => {
    const rows = parseDailyPriceResponse(fixture)
    expect(rows).toHaveLength(4)

    const egg = rows.find((r) => r.itemCode === '9903' && r.kindCode === '23')
    expect(egg).toBeDefined()
    expect(egg?.unit).toBe('30구')
    expect(egg?.today).toBe(7345)
    expect(egg?.normalYear).toBe(6830)
  })

  test('닭 절단육처럼 가격이 "0"인 행은 null로 파싱한다', () => {
    const rows = parseDailyPriceResponse(fixture)
    const cutChicken = rows.find(
      (r) => r.itemCode === '9901' && r.kindCode === '24',
    )
    expect(cutChicken?.today).toBeNull()
    expect(cutChicken?.dayAgo).toBeNull()
    expect(cutChicken?.normalYear).toBe(8726)
  })

  test('error_code가 000이 아니면 KamisApiError를 던진다', () => {
    expect(() =>
      parseDailyPriceResponse({ data: { error_code: '900', item: [] } }),
    ).toThrow(KamisApiError)
  })

  test('data가 객체가 아니면(인증 실패 등) KamisApiError를 던진다', () => {
    expect(() => parseDailyPriceResponse({ data: ['901'] })).toThrow(
      KamisApiError,
    )
  })
})

describe('pickRow / buildFeedItem', () => {
  const rows = parseDailyPriceResponse(fixture)
  const eggEntry = ITEM_CATALOG.find((e) => e.id === 'egg')
  const porkEntry = ITEM_CATALOG.find((e) => e.id === 'pork-belly')
  const chickenEntry = ITEM_CATALOG.find((e) => e.id === 'chicken')

  test('카탈로그 매핑(계란 특란30구)에 맞는 행을 고른다', () => {
    const row = pickRow(eggEntry!, rows)
    expect(row?.kindCode).toBe('23')
    expect(row?.unit).toBe('30구')
  })

  test('당일가가 있으면 price=당일가, prev=1일전가', () => {
    const item = buildFeedItem(porkEntry!, pickRow(porkEntry!, rows)!)
    expect(item).not.toBeNull()
    expect(item?.price).toBe(2913)
    expect(item?.prevPrice).toBe(2875)
    expect(item?.normalPrice).toBe(2691)
    expect(item?.verdict).toBe('normal')
  })

  test('가격이 전혀 없는 행(절단육)은 null을 반환한다', () => {
    const cutOnly = rows.filter((r) => r.kindCode === '24')
    const entry = { ...chickenEntry!, kindCodes: ['24'] }
    const row = pickRow(entry, cutOnly)
    expect(row).not.toBeNull()
    expect(buildFeedItem(entry, row!)).toBeNull()
  })
})

describe('buildMilestones', () => {
  test('저장된 행에서 존재하는 시점 가격만 추출한다', () => {
    const rows = parseDailyPriceResponse(fixture)
    const egg = rows.find((r) => r.itemCode === '9903' && r.kindCode === '23')
    const points = buildMilestones(JSON.stringify(egg))

    const labels = points.map((p) => p.label)
    expect(labels).toContain('당일')
    expect(labels).toContain('1년전')
    expect(points.find((p) => p.label === '당일')?.price).toBe(7345)
    expect(points.find((p) => p.label === '당일')?.daysAgo).toBe(0)
  })

  test('null·손상된 JSON·비객체 입력은 빈 배열을 반환한다', () => {
    expect(buildMilestones(null)).toEqual([])
    expect(buildMilestones('{잘못된 json')).toEqual([])
    expect(buildMilestones('"문자열"')).toEqual([])
  })

  test('가격이 null인 시점은 제외한다', () => {
    const points = buildMilestones(
      JSON.stringify({ today: null, dayAgo: 1000, weekAgo: null }),
    )
    expect(points).toEqual([{ label: '1일전', daysAgo: 1, price: 1000 }])
  })
})
