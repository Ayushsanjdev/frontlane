FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/database/package.json ./packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build
RUN pnpm --filter @frontlanejobs/web deploy --prod --legacy /runtime

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
RUN addgroup -S frontlanejobs && adduser -S frontlanejobs -G frontlanejobs
COPY --from=build --chown=frontlanejobs:frontlanejobs /runtime ./
USER frontlanejobs
EXPOSE 3000
CMD ["node", "--import", "./scripts/load-env.mjs", "build/index.js"]
