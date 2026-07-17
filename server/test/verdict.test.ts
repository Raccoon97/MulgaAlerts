import { describe, expect, test } from 'vitest'
import {
  deviationRate,
  judgeMovement,
  judgeVerdict,
  seasonalNormalPrice,
} from '../src/domain/verdict.js'

describe('deviationRate', () => {
  test('평시가 대비 편차율을 계산한다', () => {
    expect(deviationRate(1100, 1000)).toBeCloseTo(0.1)
    expect(deviationRate(900, 1000)).toBeCloseTo(-0.1)
    expect(deviationRate(1000, 1000)).toBe(0)
  })

  test('기준 가격이 0 이하이면 에러를 던진다', () => {
    expect(() => deviationRate(1000, 0)).toThrow()
    expect(() => deviationRate(1000, -100)).toThrow()
  })

  test('현재 가격이 음수이면 에러를 던진다', () => {
    expect(() => deviationRate(-1, 1000)).toThrow()
  })
})

describe('judgeVerdict', () => {
  test('평시보다 10% 이상 싸면 cheap', () => {
    expect(judgeVerdict(890, 1000)).toBe('cheap')
    expect(judgeVerdict(900, 1000)).toBe('cheap') // 경계값 포함
  })

  test('평시보다 10% 이상 비싸면 pricey', () => {
    expect(judgeVerdict(1110, 1000)).toBe('pricey')
    expect(judgeVerdict(1100, 1000)).toBe('pricey') // 경계값 포함
  })

  test('±10% 이내면 normal', () => {
    expect(judgeVerdict(1000, 1000)).toBe('normal')
    expect(judgeVerdict(1099, 1000)).toBe('normal')
    expect(judgeVerdict(901, 1000)).toBe('normal')
  })

  test('품목별 임계값을 조정할 수 있다', () => {
    // 변동성 큰 채소는 ±15% 임계값 사용
    expect(judgeVerdict(1120, 1000, { threshold: 0.15 })).toBe('normal')
    expect(judgeVerdict(1150, 1000, { threshold: 0.15 })).toBe('pricey')
  })
})

describe('judgeMovement', () => {
  test('전일 대비 2% 이상 오르면 up', () => {
    expect(judgeMovement(1020, 1000)).toBe('up')
  })

  test('전일 대비 2% 이상 내리면 down', () => {
    expect(judgeMovement(980, 1000)).toBe('down')
  })

  test('±2% 미만 변동은 flat', () => {
    expect(judgeMovement(1019, 1000)).toBe('flat')
    expect(judgeMovement(981, 1000)).toBe('flat')
    expect(judgeMovement(1000, 1000)).toBe('flat')
  })
})

describe('seasonalNormalPrice', () => {
  test('과거 가격 표본의 중앙값을 반환한다 (홀수 개)', () => {
    expect(seasonalNormalPrice([1000, 3000, 2000])).toBe(2000)
  })

  test('짝수 개 표본은 가운데 두 값의 평균을 반환한다', () => {
    expect(seasonalNormalPrice([1000, 2000, 3000, 4000])).toBe(2500)
  })

  test('입력 배열을 변경하지 않는다 (불변성)', () => {
    const samples = [3000, 1000, 2000]
    seasonalNormalPrice(samples)
    expect(samples).toEqual([3000, 1000, 2000])
  })

  test('빈 표본이면 에러를 던진다', () => {
    expect(() => seasonalNormalPrice([])).toThrow()
  })

  test('음수 가격이 섞여 있으면 에러를 던진다', () => {
    expect(() => seasonalNormalPrice([1000, -500])).toThrow()
  })
})
