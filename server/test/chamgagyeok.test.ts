import { describe, expect, test } from 'vitest'
import {
  CITY_STORE_ALIASES,
  ChamgagyeokError,
  LOCAL_PRODUCT_MAP,
  matchRow,
  pickLatestPath,
  storeKeywordsForCity,
} from '../src/collector/chamgagyeok.js'
import { ITEM_CATALOG } from '../src/collector/kamis-feed.js'

describe('LOCAL_PRODUCT_MAP', () => {
  test('매핑된 품목 id는 전부 KAMIS 카탈로그에 존재한다', () => {
    const catalogIds = new Set(ITEM_CATALOG.map((e) => e.id))
    for (const itemId of LOCAL_PRODUCT_MAP.keys()) {
      expect(catalogIds.has(itemId), `${itemId}가 카탈로그에 없음`).toBe(true)
    }
  })
})

describe('pickLatestPath', () => {
  test('summary의 날짜가 가장 최신인 파일 경로를 고른다', () => {
    const doc = {
      paths: {
        '/a': { get: { summary: '가격 정보_20250131' } },
        '/b': { get: { summary: '가격 정보_20260626' } },
        '/c': { get: { summary: '가격 정보_20240630' } },
      },
    }
    expect(pickLatestPath(doc)).toBe('/b')
  })

  test('날짜 있는 경로가 없으면 에러를 던진다', () => {
    expect(() => pickLatestPath({ paths: {} })).toThrow(ChamgagyeokError)
  })
})

describe('matchRow', () => {
  test('매핑 상품은 LocalPriceRow로 변환된다', () => {
    const row = matchRow({
      상품명: '돼지고기 삼겹살(100g)',
      판매업소: '롯데슈퍼안산점',
      판매가격: 2890,
      조사일: '2026-06-26',
    })
    expect(row).toEqual({
      itemId: 'pork-belly',
      product: '돼지고기 삼겹살(100g)',
      store: '롯데슈퍼안산점',
      price: 2890,
      surveyDate: '2026-06-26',
    })
  })

  test('매핑에 없는 상품·불량 가격은 null', () => {
    expect(
      matchRow({ 상품명: '신라면(5개입)', 판매업소: 'x', 판매가격: 1, 조사일: 'd' }),
    ).toBeNull()
    expect(
      matchRow({
        상품명: '돼지고기 삼겹살(100g)',
        판매업소: 'x',
        판매가격: 0,
        조사일: 'd',
      }),
    ).toBeNull()
  })
})

describe('storeKeywordsForCity', () => {
  test('별칭이 있으면 별칭 포함, 없으면 도시명 그대로', () => {
    expect(storeKeywordsForCity('성남')).toContain('분당')
    expect(storeKeywordsForCity('고양')).toContain('일산')
    expect(storeKeywordsForCity('안산')).toEqual(['안산'])
    expect(storeKeywordsForCity('전주')).toEqual(['전주'])
    expect(CITY_STORE_ALIASES.get('화성')).toContain('동탄')
  })
})
