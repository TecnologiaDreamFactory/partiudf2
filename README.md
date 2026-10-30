# PARTIU DF

Acompanhamento em tempo real da van — passageiro, motorista e administração.

Monorepo pnpm + Turborepo:

```text
apps/web/          Next.js: telas + API (/api/*) + Prisma
  prisma/          schema, migrations, seed
  src/server/      rotas da API, banco, publicação no Realtime
packages/shared/   tipos e enums compartilhados
supabase/          Supabase local (Postgres + Realtime) para desenvolvimento
```

Produção: **Vercel** (app + API) e **Supabase** (Postgres + Realtime). Guia: [docs/deploy-vercel-supabase.md](docs/deploy-vercel-supabase.md).

## Rodar localmente

Pré-requisitos: Node 20+, pnpm 9, Docker.

```bash
pnpm install

# Supabase local só deste projeto (portas 553xx — não conflita com outros projetos Supabase)
npx supabase start -x storage-api,imgproxy,edge-runtime,logflare,vector,mailpit,supavisor
npx supabase status          # mostra as chaves locais

# Variáveis: copie e preencha com as chaves do `supabase status`
cp apps/web/.env.example apps/web/.env.local

cd apps/web
pnpm db:migrate              # cria as tabelas
NODE_ENV=development pnpm db:seed   # admin + motorista/passageiros de teste + pontos
cd ../..

pnpm dev                     # http://localhost:3000
```

Studio do banco local: <http://127.0.0.1:55323>. Para parar o Supabase: `npx supabase stop`.

### Usuários de teste (seed com `NODE_ENV=development`)

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | `SEED_ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |
| Motorista | driver@local | 123456 |
| Passageiro | p1@local, p2@local | 123456 |

O passageiro não precisa de login: `/p` cria uma sessão anônima.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | App em modo desenvolvimento |
| `pnpm build` | Build de tudo |
| `pnpm --filter @partiudf/web db:migrate` | Aplica migrations (`DIRECT_URL`) |
| `pnpm --filter @partiudf/web db:seed` | Admin + pontos de embarque |
| `pnpm --filter @partiudf/web db:set-password <email> <senha>` | Troca a senha de um usuário |

Nova migration: edite `apps/web/prisma/schema.prisma` e rode `npx prisma migrate dev --name <nome>` dentro de `apps/web`.
