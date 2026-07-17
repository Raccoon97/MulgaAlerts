# 물가를알려줘 (MulgaAlerts)

**"이 가격이면 사도 되나?"에 즉시 답해주는 생활물가 판정 서비스**

계란·호박·배추 같은 장바구니 품목마다 평시 가격을 기준선으로 잡고, 오늘 가격이 싼지 비싼지를 한눈에 보여줍니다.

- 🟢 저렴 / ⚪ 보통 / 🔴 비쌈 — 품목별 판정 배지
- ▲ 상승 / ▼ 하락 — 전일 대비 등락 표시
- 평시 가격(최근 3년 같은 시기 중앙값) 기준선 제공

## 데이터 출처

- [KAMIS 농수산물유통정보](https://www.kamis.or.kr) (한국농수산식품유통공사) — 농축수산물 일일 도·소매 가격

## 문서

- [서비스 기획서](docs/기획서.md)
- [홈 대시보드 디자인 시안](docs/design/홈대시보드-시안.html)

## 프로젝트 구조

```
├── app/      # Flutter 클라이언트 (iOS · Android · 웹)
├── server/   # API 서버 + KAMIS 수집 배치 (TypeScript · Fastify)
└── docs/     # 기획서, 디자인 시안
```

### 서버 실행

```bash
cd server
npm install
npm run dev    # http://localhost:3000
npm test       # 판정 로직 단위 테스트
```

- `GET /api/health` — 헬스 체크
- `GET /api/items?category=채소` — 품목별 가격 + 판정(cheap/normal/pricey) + 등락(up/down/flat)

### 앱 실행

```bash
cd app
flutter run -d chrome   # 웹으로 실행
```

## 상태

🚧 개발 준비 중 — 웹/모바일 앱(Flutter) 동시 출시 목표. 현재 KAMIS API 키 발급 대기 중이라 서버는 샘플 데이터로 응답합니다 (`meta.source: "sample"`).
