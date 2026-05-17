## Multi-stage build for any Next.js app in the monorepo.
## Usage:
##   docker build --build-arg APP=web     --build-arg APP_VERSION=$(git rev-parse --short HEAD) -t zameen/web .
##   docker build --build-arg APP=field   --build-arg APP_VERSION=$(git rev-parse --short HEAD) -t zameen/field .
##   docker build --build-arg APP=ops     --build-arg APP_VERSION=$(git rev-parse --short HEAD) -t zameen/ops .
##   docker build --build-arg APP=approve --build-arg APP_VERSION=$(git rev-parse --short HEAD) -t zameen/approve .

ARG APP=web
ARG NODE_VERSION=20
ARG APP_VERSION=dev

FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

## --- deps ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc* ./
COPY turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile=false

## --- builder ---
FROM deps AS builder
ARG APP
ARG APP_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_VERSION=${APP_VERSION}
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
RUN pnpm --filter "@zameen/${APP}" run build

## --- runner ---
FROM node:${NODE_VERSION}-alpine AS runner
ARG APP
ARG APP_VERSION
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP=${APP}
ENV APP_VERSION=${APP_VERSION}
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs && \
    apk add --no-cache wget

COPY --from=builder /app/apps/${APP}/.next/standalone ./
COPY --from=builder /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder /app/apps/${APP}/public ./apps/${APP}/public

USER nextjs
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" | grep -q '"ok":true' || exit 1

CMD ["sh", "-c", "node apps/${APP}/server.js"]
