FROM node:22-alpine AS base
WORKDIR /app

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# 1) deps
FROM base AS deps
COPY pnpm-workspace.yaml turbo.json tsconfig.base.json package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma/ apps/api/prisma/
COPY packages/shared/ packages/shared/
RUN pnpm install --frozen-lockfile

# 2) build
FROM base AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
# Build shared primeiro (API depende dos tipos .d.ts)
  RUN rm -f packages/shared/tsconfig.tsbuildinfo
RUN pnpm --filter "./packages/shared" build
RUN ls -la packages/shared/dist && test -f packages/shared/dist/index.d.ts
# Prisma generate precisa de DATABASE_URL (não conecta; só gera o client)
ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder"
RUN pnpm --filter @partiudf/api exec prisma generate --schema=prisma/schema.prisma
RUN pnpm --filter @partiudf/api build

# 3) runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# copia build + prisma + shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

# entrypoint para migrations
COPY apps/api/entrypoint.sh ./apps/api/entrypoint.sh
RUN chmod +x ./apps/api/entrypoint.sh

# usuário não-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080
ENTRYPOINT ["./apps/api/entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
