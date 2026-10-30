#!/bin/sh
set -e

echo "[entrypoint] prisma migrate deploy"
cd /app/apps/api && DATABASE_URL="$DATABASE_URL" node ./node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma

echo "[entrypoint] start api"
cd /app && exec node ./apps/api/dist/main.js
