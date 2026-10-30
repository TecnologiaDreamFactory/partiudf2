# apps/web/Dockerfile - Next.js 15 no monorepo pnpm (Cloud Run)
# Build: docker build -f apps/web/Dockerfile .
# Context deve ser a raiz do repo

# ========== Stage 1: deps ==========
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

# Copiar lock e workspace (devDependencies necessárias para next build)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Instalar todas as deps (inclui devDependencies para build)
RUN pnpm install --frozen-lockfile

# ========== Stage 2: build ==========
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

# Copiar /app inteiro do deps (preserva symlinks do pnpm)
COPY --from=deps /app ./

# Build-time public envs (Next.js embed)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Sobrescrever com código fonte (node_modules fica do deps)
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.build.json ./packages/shared/
# Restaurar node_modules sobrescritos (host não tem por .dockerignore)
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Build: shared primeiro, depois web
RUN pnpm --filter @partiudf/shared build
RUN pnpm --filter @partiudf/web build

# ========== Stage 3: runner ==========
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copiar estrutura completa do builder (preserva symlinks pnpm)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./

# Usuário não-root (requisito Cloud Run)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 8080

CMD ["sh", "-c", "pnpm --filter @partiudf/web start -p ${PORT}"]
