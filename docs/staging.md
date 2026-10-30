# Deploy em Staging (Vercel + API externa)

## Visão geral

- **Web (frontend):** Vercel
- **API (backend):** Render, Fly.io ou similar (com HTTPS)
- **Banco de dados:** MySQL/MariaDB em cloud (PlanetScale, Railway, etc.)

---

## Variáveis de ambiente

### Vercel (apps/web)

| Variável | Obrigatório | Exemplo | Descrição |
|----------|-------------|---------|-----------|
| `NEXT_PUBLIC_API_URL` | Sim | `https://api-staging.seudominio.com` | URL base da API (HTTPS) |
| `NEXT_PUBLIC_WS_URL` | Não* | `https://api-staging.seudominio.com` | URL do Socket.IO (mesma da API) |

\* Se omitido, usa `NEXT_PUBLIC_API_URL`.

### API (apps/api – Render/Fly/etc.)

| Variável | Obrigatório | Exemplo | Descrição |
|----------|-------------|---------|-----------|
| `PORT` | Não | `3001` | Porta (Render/Fly injetam automaticamente) |
| `CORS_ORIGIN` | Sim | `https://dream-driver.vercel.app` | Origem permitida. Múltiplas: `url1,url2,url3` |
| `DATABASE_URL` | Sim | `mysql://...` | Connection string do banco |
| `JWT_SECRET` | Sim | `seu-secret-forte` | Chave para assinatura de JWT |

---

## Comandos de build/start

### Web (Vercel)

Vercel detecta Next.js automaticamente. Configuração padrão:

- **Build:** `pnpm build` (ou `next build`)
- **Output:** `.next`
- **Start:** `pnpm start` (ou `next start`)

No monorepo, use o root `pnpm build` ou configure o root do projeto no Vercel para `apps/web`.

### API (Render/Fly)

- **Build:** `pnpm build` (ou `nest build`)
- **Start:** `pnpm start` (ou `node dist/main`)

Certifique-se de que `PORT` é respeitado (plataformas cloud usam `process.env.PORT`).

---

## Checklist de testes no Android (PWA)

1. **Instalar PWA**
   - Adicione `manifest.json` e meta tags no `layout.tsx` se ainda não houver
   - Abra o site no Chrome Android
   - Menu → "Adicionar à tela inicial" ou "Instalar app"

2. **Permissão de localização**
   - Página do passageiro (`/p`) e motorista (`/d`) usam geolocalização
   - Aceite a permissão quando solicitado
   - Em Configurações → Apps, confira se o PARTIU DF tem permissão de localização

3. **Teste de tracking**
   - Login como motorista → Iniciar trip → Iniciar tracking real
   - Verifique se o ícone da van aparece e se atualiza no mapa
   - Login como passageiro (outro dispositivo/aba) → Check-in em um ponto
   - Confirme que o passageiro aparece no mapa do motorista
   - Teste "Seguir van" e "Recolher" no mapa do motorista

4. **Rotas protegidas**
   - `/` → redireciona para `/login` ou para `/d`, `/p`, `/admin` conforme role
   - `/d` → apenas DRIVER
   - `/p` → apenas PASSENGER
   - `/admin` → apenas ADMIN
   - `/profile` → autenticados
   - Token expirado (PASSENGER 1h) → redirect para `/login`

---

## Service Worker / PWA

Se configurar PWA com Service Worker (ex.: `next-pwa`):

- **Não** cacheie rotas da API (`/api/*` ou chamadas para `NEXT_PUBLIC_API_URL`)
- Mantenha `network-first` ou `network-only` para requests à API
- Evite cache agressivo que impeça updates em tempo real (Socket.IO, tracking)

---

## URLs de desenvolvimento local

| App | URL |
|-----|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
