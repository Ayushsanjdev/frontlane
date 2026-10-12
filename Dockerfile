FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/database/package.json ./packages/database/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S frontlane && adduser -S frontlane -G frontlane
COPY --from=build --chown=frontlane:frontlane /app/apps/web/.next/standalone ./
COPY --from=build --chown=frontlane:frontlane /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=frontlane:frontlane /app/apps/web/public ./apps/web/public
USER frontlane
EXPOSE 3000
CMD ["node","apps/web/server.js"]
