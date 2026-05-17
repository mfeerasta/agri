## Multi-stage build for any Next.js app in the monorepo.
## Usage: docker build --build-arg APP=web -t zameen/web .
##        docker build --build-arg APP=field -t zameen/field .

ARG APP=web
ARG NODE_VERSION=20

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
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter "@zameen/${APP}" run build

## --- runner ---
FROM node:${NODE_VERSION}-alpine AS runner
ARG APP
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/apps/${APP}/.next/standalone ./
COPY --from=builder /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder /app/apps/${APP}/public ./apps/${APP}/public

USER nextjs
ENV APP=${APP}
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "node apps/${APP}/server.js"]
