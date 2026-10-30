# Deploy do Partiu DF — Railway (Web + API + MySQL)

> Guia completo, passo a passo, para colocar o **Partiu DF** no ar sem VPS,
> com **tudo no Railway**: **Web** (Next.js) + **API** (NestJS) + **MySQL**, no mesmo projeto.
>
> Última atualização: 2026-06-07.

---

## 1. Por que essa arquitetura

O Partiu DF é um monorepo com **três peças que rodam ao mesmo tempo**:

| Peça | Tecnologia | Precisa de |
|---|---|---|
| **Web** | Next.js 15 | Servidor Node (SSR) |
| **API** | NestJS + Socket.IO | Processo Node 24/7 + WebSocket |
| **MySQL** | Prisma (adapter mariadb) | Banco de dados persistente |

Hospedagem compartilhada / "Site estático" **não roda** API NestJS, WebSocket nem MySQL.
A solução adotada é hospedar **as três peças no Railway**, cada uma como um **serviço**
dentro do **mesmo projeto** (assim elas se enxergam pela rede interna e compartilham variáveis):

```
                 Internet (HTTPS)
                       │
        ┌──────────────┴──────────────┐
        │                             │
  partiudf-web.up.railway.app   partiudf-api.up.railway.app
        │                             │
   ┌────▼────┐                  ┌─────▼─────┐
   │  WEB    │  ── fetch ─────▶ │   API     │
   │ Next.js │  ── WebSocket ─▶ │  NestJS   │
   │(Railway)│                  │ (Railway) │
   └─────────┘                  └─────┬─────┘
                                      │
                                ┌─────▼─────┐
                                │  MySQL    │
                                │ (Railway) │
                                └───────────┘
```

> **Ordem do deploy importa**: a Web precisa da URL da API, e a API precisa da URL da Web (CORS).
> Por isso: **MySQL + API primeiro** → **Web depois** → **ligar os dois** (CORS) no fim.

---

## 2. Pré-requisitos

- Conta no **GitHub** com o repositório `TecnologiaDreamFactory/partiudf` (já existe).
- Conta no **Railway** — https://railway.app
- **Node.js 20+** instalado localmente (para gerar o `JWT_SECRET` e rodar o seed via CLI).
- O repositório já está preparado para esse deploy:
  - `apps/api/Dockerfile` (API, porta dinâmica via `PORT`)
  - `apps/api/entrypoint.sh` (roda `prisma migrate deploy` no boot)
  - `apps/web/Dockerfile` (Web Next.js; recebe `NEXT_PUBLIC_*` como **build args**)
  - `package.json` com `packageManager: pnpm@9.14.2` e `pnpm.onlyBuiltDependencies` (libera build de `bcrypt`, `prisma`, `sharp`, etc.)

---

## 3. FASE 1 — Railway (MySQL + API)

### 3.1 Criar o banco MySQL

1. Acesse https://railway.app → **New Project**.
2. Escolha **Provision MySQL** (ou **Add a Database → MySQL**).
3. O banco sobe sozinho. **Não precisa configurar nada** nele agora.

### 3.2 Criar o serviço da API

1. No mesmo projeto → **New** → **GitHub Repo** → selecione `TecnologiaDreamFactory/partiudf`.
2. Abra **Settings** do serviço da API e configure:
   - **Root Directory**: `/` (a raiz — o Dockerfile copia a partir dela)
   - **Build → Dockerfile Path**: `apps/api/Dockerfile`
3. Abra **Variables** e adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (referência ao serviço MySQL) |
| `JWT_SECRET` | uma chave forte (ver 3.3) |
| `SEED_ADMIN_EMAIL` | email do admin (ex.: `ti@dreamfactory.com.br`) |
| `SEED_ADMIN_PASSWORD` | senha **numérica** forte (o login aceita só dígitos) |

> ⚠️ **Não** defina `PORT` (o Railway injeta automaticamente).
> ⚠️ **Não** defina `CORS_ORIGIN` ainda — isso é feito na Fase 3.

4. **Settings → Networking → Generate Domain** para a API ganhar uma URL pública
   (ex.: `partiudf-api.up.railway.app`). **Anote essa URL** — você vai usá-la na Fase 2.

### 3.3 Gerar o `JWT_SECRET`

No terminal local:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copie o valor gerado e cole na variável `JWT_SECRET`.

### 3.4 Conferir o deploy

Nos **logs** do serviço da API no Railway, você deve ver:

```
[entrypoint] prisma migrate deploy
...
API running on port XXXX
```

Se aparecer erro de conexão com o banco, confira se `DATABASE_URL` está como `${{MySQL.MYSQL_URL}}`
e se o serviço MySQL está no mesmo projeto.

---

## 4. FASE 2 — Railway (Web)

> Faça esta fase **somente depois** de ter a URL pública da API (Fase 1).

1. No **mesmo projeto** do Railway → **New** → **GitHub Repo** → selecione novamente
   `TecnologiaDreamFactory/partiudf` (vai virar um **segundo serviço**, o da Web).
2. Abra **Settings** do serviço da Web e configure:
   - **Root Directory**: `/` (a raiz — o Dockerfile copia a partir dela)
   - **Build → Dockerfile Path**: `apps/web/Dockerfile`
3. Abra **Variables** e adicione (troque pela URL real da API da Fase 1):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://SUA-API.up.railway.app` |
| `NEXT_PUBLIC_WS_URL` | `https://SUA-API.up.railway.app` |

> ⚠️ As variáveis `NEXT_PUBLIC_*` são **embutidas no build** (o `apps/web/Dockerfile` as recebe
> como `ARG`). O Railway repassa as variáveis do serviço como **build args** automaticamente.
> Se mudar a URL da API depois, é preciso **redeployar** a Web (Railway → Deployments → Redeploy)
> para reembutir o novo valor.
> ⚠️ **Não** defina `PORT` (o Railway injeta; o Dockerfile usa `${PORT}`).

4. **Settings → Networking → Generate Domain** para a Web ganhar uma URL pública
   (ex.: `partiudf-web.up.railway.app`). **Anote essa URL** — você vai usá-la na Fase 3 (CORS).

---

## 5. FASE 3 — Ligar os dois (CORS + admin)

### 5.1 Liberar o CORS na API

1. **Railway → serviço da API → Variables** → adicione:

| Variável | Valor |
|---|---|
| `CORS_ORIGIN` | URL da Web no Railway, com `https://` e **sem barra final** (ex.: `https://partiudf-web.up.railway.app`) |

2. Salvar reinicia a API automaticamente (o CORS é lido no boot).
   Para mais de um domínio, separe por vírgula: `https://partiudf-web.up.railway.app,https://www.seudominio.com`.

### 5.2 Criar o admin (seed — roda uma vez)

Na sua máquina, com a CLI do Railway:

```bash
npm i -g @railway/cli
railway login
railway link          # escolha o projeto e o serviço da API
railway run pnpm --filter @partiudf/api prisma:seed:prod
```

O seed usa as variáveis do Railway (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) para criar o admin.

---

## 6. Domínio próprio (opcional)

O **Railway** aceita domínio próprio com **HTTPS automático**. O recomendado
são **dois subdomínios** (um para a Web, um para a API):

| Peça | Onde | Domínio sugerido |
|---|---|---|
| Web | Railway | `app.seudominio.com.br` (ou a raiz `seudominio.com.br`) |
| API | Railway | `api.seudominio.com.br` |
| MySQL | Railway | — (interno, sem domínio público) |

### 6.1 Configurar o domínio (Web e API)

Para **cada** serviço (Web e API):

1. Railway → serviço → **Settings → Networking → Custom Domain**.
2. Digite o subdomínio desejado (`app.seudominio.com.br` para a Web, `api.seudominio.com.br` para a API).
3. O Railway mostra um registro **CNAME** (ex.: `api` → `xxxx.up.railway.app`). Crie-o no seu provedor de DNS.
4. Aguarde a propagação (minutos a algumas horas). O **SSL é emitido automaticamente**.

### 6.2 Atualizar as variáveis (obrigatório)

Ao migrar para o domínio próprio, ajuste estas variáveis — senão CORS/WebSocket quebram:

| Onde | Variável | Novo valor |
|---|---|---|
| Railway (API) | `CORS_ORIGIN` | `https://app.seudominio.com.br` |
| Railway (Web) | `NEXT_PUBLIC_API_URL` | `https://api.seudominio.com.br` |
| Railway (Web) | `NEXT_PUBLIC_WS_URL` | `https://api.seudominio.com.br` |

> ⚠️ As `NEXT_PUBLIC_*` são embutidas no build → **redeploye a Web** no Railway depois de mudar.
> O Railway **não cobra extra** por domínio próprio; você paga só o registrador (~R$40–60/ano).

---

## 7. Verificação final

1. Abra `https://SUA-API.up.railway.app/health` → deve responder `{"ok":true,...}`.
2. Abra a URL da Web no Railway no navegador.
3. Faça **login** com o admin definido no seed (senha numérica).
4. Teste o fluxo principal: mapa, rastreamento GPS, WebSocket (atualização em tempo real).

> **PWA + geolocalização** só funcionam em **HTTPS** — o Railway já fornece HTTPS por padrão. ✅

---

## 8. CI/CD (deploy automático)

- **Railway (API)**: cada `push` na branch `main` redeploya a API automaticamente.
- **Railway (Web)**: cada `push` na `main` redeploya a Web automaticamente.
- Migrations rodam sozinhas no boot da API (`entrypoint.sh` → `prisma migrate deploy`).

---

## 9. Solução de problemas

| Sintoma | Causa provável | Correção |
|---|---|---|
| `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` | pnpm novo em Node antigo | Node 20+ no ambiente (já resolvido) |
| Corepack reclama da versão do pnpm | `packageManager` ≠ pnpm do ambiente | manter `pnpm@9.14.2` (já no repo) |
| `ignored build scripts` (bcrypt/prisma/sharp) | pnpm 10/11 bloqueia scripts nativos | `pnpm.onlyBuiltDependencies` (já no `package.json`) |
| API sobe mas web dá erro de CORS | `CORS_ORIGIN` errado | bater exatamente com a URL da Web no Railway (`https://`, sem barra) |
| WebSocket não conecta | `NEXT_PUBLIC_WS_URL` errado ou CORS | apontar para a URL da API e **redeployar a Web** |
| Web mostra URL de API antiga | `NEXT_PUBLIC_*` é embutida no build | mudar a variável e **redeployar a Web** (rebuild) |
| Login retorna 400/401 | senha não numérica ou admin não criado | senha só com dígitos; rodar o seed (5.2) |
| API não conecta no banco | `DATABASE_URL` errado | usar `${{MySQL.MYSQL_URL}}`; MySQL no mesmo projeto |

---

## 10. Custos estimados

Com **tudo no Railway**, usamos o plano **Hobby (US$5/mês)**, que cobre os três serviços
(Web + API + MySQL). Os US$5 já incluem uma franquia de uso; só se passar dela é que paga
o excedente — e na prática isso fica em **centavos**.

| Item | Serviço | Custo |
|---|---|---|
| Web + API + MySQL | Railway (Hobby) | US$5/mês (+ centavos só se estourar a franquia) |
| HTTPS / SSL | Railway | Grátis (automático) |
| Domínio próprio (opcional) | registrador | ~R$40–60/ano |

> Como agora a Web também roda no Railway (não mais na Vercel), ela soma ao consumo do projeto.
> Acompanhe o uso no painel **Usage** do Railway para não estourar a franquia do Hobby.

---

## 11. Checklist resumido

- [ ] Railway: criar projeto + MySQL
- [ ] Railway: criar serviço da **API** (Dockerfile `apps/api/Dockerfile`, root `/`)
- [ ] Railway: variáveis da API `DATABASE_URL`, `JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
- [ ] Railway: gerar domínio público da API
- [ ] Railway: criar serviço da **Web** (Dockerfile `apps/web/Dockerfile`, root `/`)
- [ ] Railway: variáveis da Web `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL`
- [ ] Railway: gerar domínio público da Web
- [ ] Railway: definir `CORS_ORIGIN` (na API) = URL da Web
- [ ] Rodar seed do admin (Railway CLI)
- [ ] (Opcional) Domínio próprio na Web/API + atualizar `CORS_ORIGIN` e `NEXT_PUBLIC_*` (redeploy da Web)
- [ ] Testar: `/health`, login, mapa, GPS, WebSocket, PWA no Android
