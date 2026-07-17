/**
 * 판정 로직 — 기획서 7장.
 * 평시 가격(최근 3년 같은 시기 ±2주 표본의 중앙값) 대비 편차율로
 * 저렴/보통/비쌈을 판정하고, 전일 대비 등락을 별도 축으로 계산한다.
 */

export const DEFAULT_VERDICT_THRESHOLD = 0.1
export const MOVEMENT_THRESHOLD = 0.02

export type Verdict = 'cheap' | 'normal' | 'pricey'
export type Movement = 'up' | 'down' | 'flat'

export interface VerdictOptions {
  /** 품목별 판정 임계값. 변동성 큰 품목은 0.15 등으로 조정 */
  readonly threshold?: number
}

function assertValidPrice(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label}은(는) 0 이상의 숫자여야 합니다: ${value}`)
  }
}

/** (현재가 − 평시가) / 평시가 */
export function deviationRate(current: number, baseline: number): number {
  assertValidPrice(current, '현재 가격')
  if (!Number.isFinite(baseline) || baseline <= 0) {
    throw new RangeError(`기준 가격은 양수여야 합니다: ${baseline}`)
  }
  return (current - baseline) / baseline
}

export function judgeVerdict(
  current: number,
  baseline: number,
  options: VerdictOptions = {},
): Verdict {
  const threshold = options.threshold ?? DEFAULT_VERDICT_THRESHOLD
  const rate = deviationRate(current, baseline)
  if (rate <= -threshold) return 'cheap'
  if (rate >= threshold) return 'pricey'
  return 'normal'
}

export function judgeMovement(current: number, previous: number): Movement {
  const rate = deviationRate(current, previous)
  if (rate >= MOVEMENT_THRESHOLD) return 'up'
  if (rate <= -MOVEMENT_THRESHOLD) return 'down'
  return 'flat'
}

/** 과거 같은 시기 가격 표본의 중앙값 = 평시 가격. 입력 배열은 변경하지 않는다. */
export function seasonalNormalPrice(samples: readonly number[]): number {
  if (samples.length === 0) {
    throw new RangeError('평시 가격 계산에는 1개 이상의 가격 표본이 필요합니다')
  }
  for (const price of samples) assertValidPrice(price, '가격 표본')

  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}
