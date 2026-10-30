# Plano de Deploy na Hostinger — Partiu DF

> Guia para hospedar o app (web Next.js + api NestJS + MySQL) na Hostinger.

## Contexto técnico do app

- **API** (NestJS): Dockerfile pronto (`apps/api/Dockerfile`), porta **8080**, usa **Socket.IO/WebSocket**, roda `prisma migrate deploy` no boot (`entrypoint.sh`), precisa de `DATABASE_URL` e `JWT_SECRET`.
- **Web** (Next.js 15): Dockerfile pronto (`apps/web/Dockerfile`), porta **8080**. As variáveis `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` são **embutidas no build** (build args), não em runtime.
- **Banco**: MySQL/MariaDB (Prisma com adapter mariadb).
- **PWA + geolocalização** → exigem **HTTPS obrigatório**.

---

## 1. Ponto crítico: precisa de VPS (não hospedagem compartilhada)

A hospedagem **compartilhada/Cloud da Hostinger é PHP** — não roda Node.js, NestJS, WebSocket nem Docker. Este app **exige um VPS** (plano **KVM**, com acesso root).

| Recurso | Recomendado | Mínimo |
|---|---|---|
| Plano VPS | **KVM 2** (2 vCPU / 8 GB RAM) | KVM 1 (1 vCPU / 4 GB) |
| Por quê | `next build` consome bastante RAM | Funciona com swap ativo |
| SO / template | **Ubuntu 24.04** ou template **Coolify** | Ubuntu 24.04 |

---

## 2. Arquitetura alvo

```
                    Internet (HTTPS)
                          │
              ┌───────────┴───────────┐
        app.seudominio.com      api.seudominio.com
              │                         │
        ┌─────▼─────┐             ┌─────▼─────┐
        │  WEB      │  ──fetch──▶ │  API      │
        │ Next.js   │  ──WS────▶  │ NestJS    │
        │ :8080     │             │ :8080     │
        └───────────┘             └─────┬─────┘
                                        │
                                  ┌─────▼─────┐
                                  │ MySQL/    │
                                  │ MariaDB   │ (volume persistente)
                                  └───────────┘
```

Usar **dois subdomínios** (`app.` e `api.`) mantém CORS e WebSocket limpos.

---

## 3. Caminho recomendado: VPS + Coolify (PaaS em Docker)

A Hostinger oferece **Coolify** como template de 1 clique. É um "Heroku self-hosted" que conecta no GitHub (`partiudf`), faz build pelos **Dockerfiles existentes**, gerencia **SSL automático (Let's Encrypt)**, subdomínios, banco e **auto-deploy a cada push**.

**Passos:**

1. Contratar VPS **KVM 2** → escolher template **Coolify** (ou instalar: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`).
2. Apontar o **DNS** do domínio para o IP do VPS (registros A: `app`, `api` e o painel do Coolify).
3. No Coolify, conectar o repositório **GitHub `TecnologiaDreamFactory/partiudf`**.
4. Criar 3 recursos:
   - **Database** → MySQL (ou MariaDB) com volume persistente.
   - **App "api"** → build por `apps/api/Dockerfile`, domínio `api.seudominio.com`, porta `8080`.
   - **App "web"** → build por `apps/web/Dockerfile`, domínio `app.seudominio.com`, porta `8080`.
5. Configurar variáveis (seção 5) — **as `NEXT_PUBLIC_*` da web são build args**.
6. Deploy. SSL é emitido automaticamente; as migrations rodam no boot da API.
7. Rodar o **seed de produção** uma vez (cria o admin):
   `pnpm --filter @partiudf/api prisma:seed:prod` (com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` definidos — obrigatórios).

> Alternativa equivalente 1‑clique: **Dokploy** (mesmo conceito).

---

## 3b. Alternativa manual (sem PaaS)

VPS Ubuntu + **Docker Compose** (api + web + mysql) + **nginx** como reverse proxy + **certbot** para SSL. Mais controle, porém configuração e renovação de certificados manuais.

---

## 4. Banco de dados

- Rodar **MySQL 8 ou MariaDB em container** no VPS, com **volume persistente** e senha forte.
- **Backup automático**: dump diário via cron + retenção; a Hostinger também oferece snapshots do VPS.
- `DATABASE_URL` aponta para o serviço do banco na rede interna do Docker.

---

## 5. Variáveis de ambiente (produção)

### API (`api.seudominio.com`)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `mysql://partiu:SENHA_FORTE@mysql:3306/partiudf` |
| `JWT_SECRET` | chave forte única (gere uma nova p/ prod) |
| `CORS_ORIGIN` | `https://app.seudominio.com` |
| `PORT` | `8080` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | apenas para rodar o seed de prod |

### WEB (`app.seudominio.com`) — ⚠️ build args (embutidas no build)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.seudominio.com` |
| `NEXT_PUBLIC_WS_URL` | `https://api.seudominio.com` |

> Se mudar a URL da API depois, é preciso **rebuildar** a web (as `NEXT_PUBLIC_*` ficam congeladas no build).

---

## 6. Pontos de atenção específicos

- **HTTPS obrigatório**: PWA (`manifest.json`) e **geolocalização** só funcionam em HTTPS.
- **WebSocket (Socket.IO)**: no nginx manual, precisa dos headers `Upgrade`/`Connection`. Mantenha **1 instância da API** (sem réplicas) para evitar sticky sessions.
- **CORS**: `CORS_ORIGIN` deve bater exatamente com o domínio da web (com `https://`).
- **Migrations automáticas**: `entrypoint.sh` roda `prisma migrate deploy` no boot — o banco precisa estar acessível antes da API subir.

---

## 7. CI/CD

Coolify/Dokploy criam um **webhook no GitHub**: cada `push` na `main` do `partiudf` dispara build + deploy automático.

---

## 8. Checklist resumido

- [ ] Contratar VPS KVM (≥ KVM 2 recomendado)
- [ ] Instalar Coolify (template ou script)
- [ ] Comprar/configurar domínio + DNS (A records `app`, `api`)
- [ ] Conectar GitHub `partiudf` no Coolify
- [ ] Criar banco MySQL/MariaDB (volume + backup)
- [ ] Criar app **api** (Dockerfile, env, domínio `api.`)
- [ ] Criar app **web** (Dockerfile, build args `NEXT_PUBLIC_*`, domínio `app.`)
- [ ] Deploy + verificar SSL
- [ ] Rodar seed de produção (admin)
- [ ] Testar: login, mapa, tracking GPS, WebSocket, PWA no Android

---

## Custos estimados (referência)

- **VPS KVM 2**: faixa de ~R$ 30–60/mês (varia com promoções/contrato anual).
- **Domínio**: ~R$ 40–60/ano.
- SSL: gratuito (Let's Encrypt).
