FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S frontlane && adduser -S frontlane -G frontlane
COPY --from=build --chown=frontlane:frontlane /app/.next/standalone ./
COPY --from=build --chown=frontlane:frontlane /app/.next/static ./.next/static
COPY --from=build --chown=frontlane:frontlane /app/public ./public
USER frontlane
EXPOSE 3000
CMD ["node","server.js"]
