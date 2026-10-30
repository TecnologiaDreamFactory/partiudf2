# Deploy — Vercel + Supabase

Tudo roda em dois serviços:

| Peça | Onde | O que faz |
|---|---|---|
| App + API | **Vercel** (Next.js) | Telas e rotas `/api/*` (login, viagens, check-ins, admin) |
| Banco + tempo real | **Supabase** | Postgres e Realtime (posição da van e check-ins ao vivo) |

Não existe mais servidor próprio (o antigo NestJS + Socket.IO + MySQL saiu).

---

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo, de preferência). Guarde a senha do banco.
2. Em **Connect**, copie duas strings de conexão:
   - **Transaction pooler** (porta **6543**) → vai ser o `DATABASE_URL`.
   - **Session pooler** (porta **5432**) → vai ser o `DIRECT_URL` (só para migrations).
3. Em **Project Settings → API Keys**, copie:
   - a chave **publishable** (ou `anon`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
   - a chave **secret** (ou `service_role`) → `SUPABASE_SERVICE_ROLE_KEY`. **Nunca** exponha essa no front.
4. Em **Realtime → Settings**, desligue **"Allow public access"**. O app só usa canais privados.

### Criar as tabelas e o primeiro admin

Na sua máquina, com as strings de produção:

```bash
cd apps/web
DIRECT_URL="postgresql://...:5432/postgres" pnpm db:migrate
DIRECT_URL="postgresql://...:5432/postgres" SEED_ADMIN_EMAIL=voce@empresa.com SEED_ADMIN_PASSWORD=12345678 pnpm db:seed
```

A migration `0002_supabase_security` já:
- liga **RLS** em todas as tabelas, sem políticas — a Data API do Supabase não devolve nada com a chave pública (o app acessa pelo Prisma, que não passa por ela);
- permite que o navegador **ouça** os canais de tempo real, mas **não publique** neles. Só o servidor publica, com a chave secreta.

---

## 2. Vercel

1. **Add New → Project** e importe o repositório.
2. **Root Directory:** `apps/web`.
3. **Build Command:** `cd ../.. && pnpm turbo build --filter=@partiudf/web`
   (compila o pacote `@partiudf/shared` antes; o build do web já roda `prisma generate`).
4. **Environment Variables:**

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Transaction pooler (6543) |
| `DIRECT_URL` | Session pooler (5432) |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<projeto>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publishable/anon |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secret/service_role |
| `NEXT_PUBLIC_PASSENGER_CHECKIN_ENABLED` | `true` se o check-in do passageiro for usado |

`NEXT_PUBLIC_API_URL` **não** é necessária: a API está no mesmo domínio (`/api`).

5. Deploy. Teste em `https://<app>.vercel.app/api/health` → `{"ok":true,...}`.

---

## 3. Depois do deploy

- **Novas migrations:** rode `pnpm db:migrate` com o `DIRECT_URL` de produção antes (ou logo depois) do deploy que precisa delas.
- **Trocar senha de alguém:** `DIRECT_URL=... pnpm db:set-password email@x.com 1234`.
- **Planos:** o Hobby da Vercel é só para uso não comercial; o Supabase grátis pausa o projeto após ~1 semana sem uso. Para operação real, planos pagos.

## Como o tempo real funciona

```text
motorista ──POST /api/trips/:id/location──▶ Vercel ──grava──▶ Postgres
                                              │
                                              └─broadcast (chave secreta)─▶ Supabase Realtime
                                                                                │
passageiros ◀──────────── canal privado "trip:<id>" (só leitura) ◀──────────────┘
```

Canais: `trips` (viagem iniciada/encerrada) e `trip:<id>` (`trip.location`, `checkin.created`, `checkin.canceled`, `trip.ended`).
