/**
 * KAMIS API 키 발급 전까지 사용하는 합성 샘플 데이터.
 * 값은 디자인 시안과 동일한 예시값이며 실제 시세가 아니다.
 * 키 발급 후 수집 파이프라인이 붙으면 이 파일은 테스트 픽스처로만 남긴다.
 */

export type Category = '채소' | '과일' | '축산' | '수산' | '곡물'

export interface SampleItem {
  readonly id: string
  readonly name: string
  readonly unit: string
  readonly category: Category
  readonly price: number
  readonly prevPrice: number
  readonly normalPrice: number
}

export const SAMPLE_ITEMS: readonly SampleItem[] = [
  { id: 'cabbage', name: '배추', unit: '1포기', category: '채소', price: 5980, prevPrice: 5760, normalPrice: 4600 },
  { id: 'zucchini', name: '애호박', unit: '1개', category: '채소', price: 2480, prevPrice: 2350, normalPrice: 1800 },
  { id: 'lettuce', name: '상추', unit: '100g', category: '채소', price: 1480, prevPrice: 1320, normalPrice: 980 },
  { id: 'cucumber', name: '오이', unit: '3개', category: '채소', price: 3240, prevPrice: 3180, normalPrice: 2900 },
  { id: 'onion', name: '양파', unit: '1kg', category: '채소', price: 1650, prevPrice: 1690, normalPrice: 2100 },
  { id: 'potato', name: '감자', unit: '1kg', category: '채소', price: 2190, prevPrice: 2280, normalPrice: 2600 },
  { id: 'radish', name: '무', unit: '1개', category: '채소', price: 2340, prevPrice: 2300, normalPrice: 2200 },
  { id: 'green-onion', name: '대파', unit: '1kg', category: '채소', price: 2890, prevPrice: 2980, normalPrice: 3100 },
  { id: 'apple', name: '사과', unit: '10개', category: '과일', price: 32400, prevPrice: 31800, normalPrice: 27000 },
  { id: 'watermelon', name: '수박', unit: '1통', category: '과일', price: 21800, prevPrice: 22300, normalPrice: 22000 },
  { id: 'tomato', name: '토마토', unit: '1kg', category: '과일', price: 4980, prevPrice: 5080, normalPrice: 5400 },
  { id: 'banana', name: '바나나', unit: '100g', category: '과일', price: 298, prevPrice: 302, normalPrice: 340 },
  { id: 'egg', name: '계란', unit: '특란 30구', category: '축산', price: 6180, prevPrice: 6260, normalPrice: 6950 },
  { id: 'pork-belly', name: '삼겹살', unit: '100g', category: '축산', price: 2690, prevPrice: 2670, normalPrice: 2750 },
  { id: 'chicken', name: '닭고기', unit: '1kg', category: '축산', price: 5990, prevPrice: 6140, normalPrice: 6300 },
  { id: 'mackerel', name: '고등어', unit: '1마리', category: '수산', price: 4490, prevPrice: 4290, normalPrice: 3900 },
  { id: 'squid', name: '오징어', unit: '1마리', category: '수산', price: 4280, prevPrice: 4300, normalPrice: 4500 },
  { id: 'rice', name: '쌀', unit: '20kg', category: '곡물', price: 59800, prevPrice: 59400, normalPrice: 58000 },
  { id: 'tofu', name: '두부', unit: '1모', category: '곡물', price: 1890, prevPrice: 1880, normalPrice: 1800 },
]
