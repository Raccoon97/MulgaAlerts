# ── 빌드 단계 ─────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── 실행 단계 ─────────────────────────────────────
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# SQLite 볼륨 마운트 지점 (호스팅에서 /data 볼륨 연결)
ENV MULGA_DB_PATH=/data/mulga.db

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
# KAMIS_CERT_KEY / KAMIS_CERT_ID 는 호스팅 환경 변수(secret)로 주입
CMD ["node", "dist/index.js"]
