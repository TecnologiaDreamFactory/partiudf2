# PARTIU DF — Manual técnico consolidado

> Documento único reunindo: instruções para rodar o app, bibliotecas utilizadas, decisões de design, mudanças feitas na sessão de 2026-05-22 e plano para virar APK com notificações push.

---

## Sumário

1. [Visão geral do stack](#1-visão-geral-do-stack)
2. [Bibliotecas e ferramentas](#2-bibliotecas-e-ferramentas)
3. [Como rodar o app localmente](#3-como-rodar-o-app-localmente)
4. [Style guide PARTIU DF](#4-style-guide-dream-factory)
5. [Dark mode](#5-dark-mode)
6. [Splash animado com a van](#6-splash-animado-com-a-van)
7. [Decisões e correções de UX](#7-decisões-e-correções-de-ux)
8. [Sem login obrigatório para passageiro](#8-sem-login-obrigatório-para-passageiro)
9. [Arquivos modificados na sessão](#9-arquivos-modificados-na-sessão)
10. [Plano: virar APK + notificações push](#10-plano-virar-apk--notificações-push)
11. [Próximos passos sugeridos](#11-próximos-passos-sugeridos)

---

## 1. Visão geral do stack

- **Monorepo** com pnpm + Turborepo
- **Web** (`apps/web`): Next.js 15 (App Router), React 19
- **API** (`apps/api`): NestJS, Socket.IO, Prisma 7
- **Banco**: MySQL 8 (via Docker em desenvolvimento)
- **Shared** (`packages/shared`): tipos e enums

Estrutura de pastas:

```
dream-driver/
├── apps/
│   ├── web/          # Next.js (frontend)
│   └── api/          # NestJS (backend)
├── packages/
│   └── shared/       # Tipos e enums compartilhados
├── docker-compose.yml   # MySQL para desenvolvimento
├── docs/                # documentação (este arquivo + outros)
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## 2. Bibliotecas e ferramentas

### 2.1. Runtime

| Pacote | Versão (aprox.) | Para que |
|---|---|---|
| Node.js | 20+ (testado em 24) | Runtime JS |
| pnpm | 9.14.2 | Gerenciador de pacotes monorepo |
| Turborepo | 2.x | Orquestrador de tarefas no monorepo |
| Docker | — | MySQL local em container |

### 2.2. Frontend (`apps/web`)

| Pacote | Para que |
|---|---|
| `next` 15.5 | Framework React com SSR/SSG, App Router |
| `react` 19 | Biblioteca de UI |
| `tailwindcss` | Utility-first CSS, tokens via CSS variables |
| `motion` (Framer Motion v12) | Animações declarativas hardware-accelerated (splash, fade, badges) |
| `class-variance-authority` | Variantes tipadas em Button/Badge |
| `clsx` + `tailwind-merge` | Util `cn()` para mesclar classes Tailwind |
| `lucide-react` | Ícones (MapPin, Wifi, RefreshCw, Sun/Moon, etc.) |
| `sonner` | Toasts (sucesso/erro/loading) |
| `next-themes` | Light/Dark mode com SSR seguro |
| `leaflet` | Mapa OpenStreetMap |
| `socket.io-client` | Real-time com o backend |

### 2.3. Backend (`apps/api`)

| Pacote | Para que |
|---|---|
| `@nestjs/core` | Framework Node modular |
| `@nestjs/websockets` + `socket.io` | Real-time (`trip.location`, `checkin.created`, etc.) |
| `@nestjs/jwt` + `passport-jwt` | Autenticação JWT |
| `@prisma/client` 7 | ORM type-safe |
| `@prisma/adapter-mariadb` | Driver MariaDB/MySQL |
| `bcrypt` | Hash de senhas |
| `class-validator` + `class-transformer` | Validação de DTOs |
| `dotenv` | Leitura de `.env` |

### 2.4. Tooling de dev

| Pacote | Para que |
|---|---|
| `prisma` CLI | Migrations, generate, db push |
| `eslint` 9 + `eslint-config-prettier` | Lint |
| `prettier` 3 | Formatação |
| `typescript` | Tipagem estática |

---

## 3. Como rodar o app localmente

### 3.1. Pré-requisitos

- Node.js 20+ — [nodejs.org](https://nodejs.org)
- Docker (para o MySQL) — [docker.com](https://docker.com)
- pnpm: `npm install -g pnpm`

### 3.2. Subir o banco (MySQL via Docker)

```bash
docker-compose up -d
```

Container: `dreamdriver-mysql` na porta `3306`, usuário `root` / senha `root`, banco `dreamdriver`.

### 3.3. Instalar dependências

```bash
pnpm install --ignore-scripts
```

> A flag `--ignore-scripts` é necessária em Node 24 com pnpm 9.14.2 (crash no postinstall do bcrypt). Cria os `.bin` mas pula postinstall problemáticos.

### 3.4. Configurar Prisma client (apps/api)

```bash
cd apps/api
node node_modules/prisma/build/index.js db push        # aplica o schema
node node_modules/prisma/build/index.js generate       # gera o client
node prisma/patch-client-node25.js                     # patch Node 24+
```

> O patch substitui `require('#main-entry-point')` por `require('./index.js')` no client gerado, contornando o erro `ERR_PACKAGE_IMPORT_NOT_DEFINED` do Node 24+ com Prisma 7.

### 3.5. Popular o banco (seed)

```bash
cd apps/api
NODE_ENV=development node prisma/seed.js
```

Usuários de teste criados:

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | `admin@local` | `1234` (padrão) ou `312408` (alterada na sessão) |
| Motorista | `driver@local` | `123456` |
| Passageiro | `p1@local` / `p2@local` | `123456` |

> Regra de senha do app: **somente dígitos, 4 a 8 caracteres** ([apps/api/src/auth/password.util.ts:3](../apps/api/src/auth/password.util.ts#L3)).

Para trocar a senha do admin:

```bash
cd apps/api
node prisma/set-password.js admin@local 312408
```

### 3.6. Subir o projeto

**Dev (hot reload):**
```bash
pnpm dev
```

**Prod (sem botão "N" do Next, mais rápido):**
```bash
pnpm --filter @partiudf/web build
# em outro terminal:
pnpm --filter @partiudf/api start
pnpm --filter @partiudf/web start
```

### 3.7. URLs

- Web: <http://localhost:3000> (passageiro abre direto, sem login)
- API: <http://localhost:3001>
- Banco (DBeaver/Workbench): `localhost:3306` user `root` senha `root` banco `dreamdriver`

### 3.8. Conexão direta no banco

```bash
docker exec -it dreamdriver-mysql mysql -uroot -proot dreamdriver
```

---

## 4. Style guide PARTIU DF

### 4.1. Tokens de design (CSS variables)

Definidos em [apps/web/src/app/globals.css](../apps/web/src/app/globals.css), expostos no Tailwind via [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts):

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--df-blue` | `#00A8E8` | `#29B6F0` | Botão primário, links, destaques |
| `--df-blue-dark` | `#0086BD` | `#00A8E8` | Hover / pressed |
| `--df-blue-soft` | `#E6F6FE` | `rgba(0,168,232,0.14)` | Fundo de chip "atual" |
| `--df-ink` | `#0A1929` | `#E2E8F0` | Texto principal |
| `--df-muted` | `#64748B` | `#94A3B8` | Texto secundário |
| `--df-surface` | `#FFFFFF` | `#0F172A` | Fundo de cards |
| `--df-surface-2` | `#F8FAFC` | `#0A1224` | Fundo da página |
| `--df-border` | `#E2E8F0` | `#1F2A44` | Bordas |
| `--df-danger` | `#DC2626` | `#F87171` | Erros / cancelar |
| `--df-success` | `#16A34A` | `#34D399` | OK |
| `--df-warning` | `#D97706` | `#FBBF24` | Atenção |

### 4.2. Tipografia

- **Body**: Inter (`var(--font-inter)`)
- **Display**: Outfit (`var(--font-outfit)`)

Configurado no [layout.tsx](../apps/web/src/app/layout.tsx) via `next/font/google`.

### 4.3. Componentes UI (`apps/web/src/components/ui/`)

| Arquivo | Descrição |
|---|---|
| `Button.tsx` | Variantes `primary`, `ghost`, `outline`, `danger`, `dangerSolid`, `subtle`. Sizes `sm`/`md`/`lg`/`icon`. Props `isLoading`, `fullWidth` (true/false/responsive) |
| `Card.tsx` | + `CardHeader`, `CardTitle`, `CardDescription` |
| `Input.tsx` | Suporte a `label`, `error`, `hint`. Acessível com `aria-describedby` / `aria-invalid` |
| `Badge.tsx` | Variantes `brand`, `neutral`, `success`, `warning`, `danger`, `live` (ponto pulsante) |
| `Skeleton.tsx` | Animação shimmer com cores que trocam em dark mode |
| `EmptyState.tsx` | Ícone + título + descrição + ação para estados vazios/erro |

### 4.4. Componentes globais

| Arquivo | Descrição |
|---|---|
| [`Logo.tsx`](../apps/web/src/components/Logo.tsx) | Usa o PNG em `public/logo2.png` |
| [`AppShell.tsx`](../apps/web/src/components/AppShell.tsx) | Header sticky com backdrop blur, logo, título, badge, ações e ThemeToggle |
| [`ThemeProvider.tsx`](../apps/web/src/components/ThemeProvider.tsx) | Wrapper de `next-themes` |
| [`ThemeToggle.tsx`](../apps/web/src/components/ThemeToggle.tsx) | Botão sol/lua (light ↔ dark, sem opção sistema) |
| [`TimeAgo.tsx`](../apps/web/src/components/TimeAgo.tsx) | "Xs / Xmin atrás" com tick interno isolado |
| [`VanLoader.tsx`](../apps/web/src/components/VanLoader.tsx) | Splash com a van animada via motion |

### 4.5. PWA

- Manifest em [apps/web/public/manifest.json](../apps/web/public/manifest.json) — `name`, `short_name`, `theme_color: #00A8E8`, `display: standalone`
- `<meta theme-color>` no layout (variantes claro `#00A8E8` e escuro `#0F172A`)
- `apple-web-app-capable`, viewport `width=device-width`, `viewport-fit=cover` (notch iOS)
- Botões e links em mobile com alvo mínimo **44×44px** via CSS em `globals.css` (`@media (pointer: coarse)`)

---

## 5. Dark mode

- `darkMode: 'class'` no Tailwind
- Tokens viraram CSS variables → componentes não precisam de `dark:` em cada lugar; basta usar `bg-df-surface`, `text-df-ink`, etc.
- `next-themes` controlando `<html class="light|dark">`, com `suppressHydrationWarning` no `<html>`
- `colorScheme: dark` no CSS para form controls nativos seguirem o tema
- Ajustes nos controles do Leaflet (`.leaflet-control-zoom`, atribuição) em dark
- Toggle só alterna entre claro e escuro (default inicial: sistema operacional)

---

## 6. Splash animado com a van

Tela de carregamento personalizada com a van PARTIU DF atravessando antes do app abrir.

### 6.1. Biblioteca

[`motion`](https://motion.dev) — Framer Motion v12, animações React declarativas, hardware-accelerated.

```bash
pnpm --filter @partiudf/web add motion --ignore-scripts
```

### 6.2. Asset

`apps/web/public/van.png` (PNG da van; espelhada por CSS `transform: scaleX(-1)` para apontar na direção certa).

### 6.3. Componente

[`apps/web/src/components/VanLoader.tsx`](../apps/web/src/components/VanLoader.tsx):

- Van da **direita para a esquerda**, 5.5s por travessia, loop infinito
- Estrada pontilhada azul correndo no sentido oposto (esquerda → direita)
- Três bolinhas pulsando ao lado da mensagem ("Procurando a van…")
- `will-change: transform / background-position` para GPU

### 6.4. Splash gate (mínimo 5s + fade in/out)

A página `/p` foi alterada para garantir que **a aplicação só monte depois que o splash termine**:

```tsx
// Estado de splash com tempo mínimo de 5s.
const [splashDone, setSplashDone] = useState(false);
useEffect(() => {
  const t = setTimeout(() => setSplashDone(true), 5000);
  return () => clearTimeout(t);
}, []);

const showSplash = authOk === null || (authOk === true && !splashDone);
const showApp   = authOk === true && splashDone;
```

**Comportamento:**

- Splash entra com fade-in (0.6s) e sai com fade-out (0.6s) via `<AnimatePresence>` + `<motion.div>`
- Cobre tela inteira em `z-[9999]` (acima de qualquer controle do Leaflet)
- Enquanto `showApp` for falso, **nada** da aplicação é montado:
  - `<AppShell>` não renderiza
  - `<MapView>` não renderiza (mapa não baixa tiles)
  - `useEffect` de polling `syncStatus` (a cada 4s) não dispara
  - `useEffect` de Socket.IO connect/listeners não dispara
  - Endpoint de pickup points não é chamado
- Quando `showApp` flipa para true, a AppShell monta e o splash inicia o fade-out

Em caso de erro de bootstrap (não consegue criar sessão), o splash é ignorado e a tela de erro é renderizada direto com botão "Tentar novamente".

---

## 7. Decisões e correções de UX

### 7.1. "Salto" da UI durante viagem ativa

**Causa:** `setInterval(forceTick, 1000)` no `/p` re-renderizava a página inteira a cada segundo. Textos "Última atualização: Xs atrás" mudavam de largura, cards mudavam de altura.

**Correção:**

- Removido `forceTick`
- Criado [`<TimeAgo>`](../apps/web/src/components/TimeAgo.tsx) com tick interno
- Criado `LiveOrWeakBadge` (inline no `/p`) com tick interno
- Criado `MapHud` no [MapView.tsx](../apps/web/src/components/MapView.tsx) com tick interno
- `min-h-[1.25rem]` no `CardDescription`
- `min-w-[88px]` no badge live/weak
- `min-w-[140px]` no HUD do mapa
- `fontVariantNumeric: 'tabular-nums'` no contador de segundos

### 7.2. "Salto" quando não há viagem ativa

**Causa:** `syncStatus()` a cada 4s forçava `setUi('LOADING')` antes do fetch, fazendo a tela piscar entre skeleton ↔ empty state.

**Correção:** `syncStatus()` mantém o estado atual durante refresh em background. `LOADING` só aparece no primeiro carregamento. Também usa setter funcional para evitar criar novas refs vazias em arrays já vazios.

### 7.3. Botão "N" do Next.js DevTools

Só existe em modo dev. Em produção (`next start` após `next build`) **não aparece**. Passageiros nunca o veem.

Workarounds em dev tentados (sem sucesso total):

- `devIndicators: false` em `next.config.ts`
- `experimental.devtoolSegmentExplorer: false`
- `POST /__nextjs_disable_dev_indicator` (esconde por 24h)

Conclusão: rodar em prod para demonstrações.

### 7.4. Erro de GPS "1 - Permissão negada"

Vem do browser, não do app (`PERMISSION_DENIED` da Geolocation API). Resolver em:

- Chrome/Edge → ícone de cadeado na URL → Localização → Permitir
- Windows: Configurações → Privacidade e segurança → Localização → ativar serviço + permitir apps de desktop

Acessado por **IP** em outro dispositivo (ex.: celular em `http://192.168.x.x:3000`)? O browser bloqueia GPS porque não é HTTPS — precisa de túnel HTTPS (ngrok / cloudflared) ou certificado mkcert.

### 7.5. Badge "Aguardando viagem" removido

A pedido — quando não há viagem ativa, o header fica só com "Passageiro" sem badge.

---

## 8. Sem login obrigatório para passageiro

A pedido — passageiro nunca passa por tela de login.

**Mudanças:**

- [`/` (page.tsx)](../apps/web/src/app/page.tsx) sempre redireciona para `/p`, sem checar role
- [`/p`](../apps/web/src/app/p/page.tsx) sempre renderiza a UI de passageiro. Se localStorage tiver sessão de ADMIN/DRIVER, é **ignorada** e uma sessão de convidado é criada via `ensurePassengerSession()` ([apps/web/src/lib/auth/passengerSession.ts](../apps/web/src/lib/auth/passengerSession.ts))
- Sessão de convidado usa um `guestId` (UUID em `localStorage`) e bate em `POST /auth/passenger-session` no API
- Admin e motorista continuam fazendo login em `/login` → redirecionado a `/admin` ou `/d`

---

## 9. Arquivos modificados na sessão

```
apps/web/
├── next.config.ts                          (devIndicators: false, experimental.devtoolSegmentExplorer: false)
├── tailwind.config.ts                      (darkMode: class, tokens df-* via CSS variables)
├── package.json                            (CVA, clsx, twmerge, lucide, sonner, next-themes, motion)
├── public/
│   ├── manifest.json                       (PWA)
│   ├── logo2.png                           (logo PARTIU DF)
│   └── van.png                             (NEW — usado no VanLoader)
└── src/
    ├── app/
    │   ├── layout.tsx                      (Inter+Outfit, ThemeProvider, Toaster, viewport, theme-color light+dark)
    │   ├── globals.css                     (tokens light+dark, skeleton, safe-area, leaflet ajustes)
    │   ├── page.tsx                        (sempre redirect /p)
    │   ├── p/page.tsx                      (refatorada inteira + sem login + splash gate)
    │   ├── login/page.tsx                  (com Logo + ThemeToggle, hint senha)
    │   ├── d/page.tsx                      (sweep cores → df-*)
    │   ├── admin/page.tsx                  (sweep cores → df-*)
    │   └── profile/page.tsx                (sweep cores → df-*)
    ├── components/
    │   ├── Logo.tsx                        (usa /logo2.png)
    │   ├── AppShell.tsx                    (header sticky + ThemeToggle)
    │   ├── ThemeProvider.tsx               (NEW)
    │   ├── ThemeToggle.tsx                 (NEW — só light/dark)
    │   ├── TimeAgo.tsx                     (NEW — isolado)
    │   ├── VanLoader.tsx                   (NEW — splash com motion)
    │   ├── MapView.tsx                     (MapHud isolado, tokens df-*)
    │   └── ui/
    │       ├── Button.tsx                  (CVA, variantes, isLoading)
    │       ├── Card.tsx                    (+ Header/Title/Description)
    │       ├── Input.tsx                   (hint, aria-invalid)
    │       ├── Badge.tsx                   (NEW)
    │       ├── Skeleton.tsx                (NEW)
    │       └── EmptyState.tsx              (NEW)
    └── lib/
        └── utils.ts                        (NEW — cn() helper)

apps/api/
└── prisma/
    └── (scripts já existentes: patch-client-node25.js, set-password.js, seed.js)

docs/
├── dream-factory-manual.md                 (este arquivo)
├── dream-factory-manual.html               (versão HTML)
├── sessao-2026-05-22-front-passageiro.md   (notas detalhadas da sessão)
└── plano-apk-notificacoes.md               (plano técnico para APK + push)
```

---

## 10. Plano: virar APK + notificações push

Estratégia em **duas fases**. Detalhamento completo em [docs/plano-apk-notificacoes.md](./plano-apk-notificacoes.md).

### 10.1. Fase 1 — PWA + Web Push (~4 dias)

Caminho mais curto, sem Play Store. Passageiros instalam pelo Chrome Android ("Adicionar à tela inicial"). Notificações funcionam mesmo com o app fechado em Android.

**Tarefas:**

1. Gerar ícones (192, 384, 512, maskable, apple-touch)
2. Atualizar `manifest.json` com novos ícones + `purpose: maskable`
3. Criar `apps/web/public/sw.js` (service worker com `push` + `notificationclick`)
4. Registrar service worker em layout
5. Lib `apps/web/src/lib/push.ts` com `subscribePush()`
6. UI: botão "🔔 Ativar notificações" em `/p`
7. Schema Prisma: model `PushSubscription`
8. Endpoint Nest `POST /push/subscribe` e `DELETE /push/subscribe`
9. PushService usando `web-push` (com chaves VAPID)
10. Gatilhos: `trip.started`, `van.approaching`, `trip.ended`

**Pré-requisitos:**

- HTTPS em produção
- Chaves VAPID (`npx web-push generate-vapid-keys`)

**Limitação iOS:** funciona apenas se usuário "Adicionar à Tela de Início" (iOS 16.4+).

### 10.2. Fase 2 — APK nativo via Capacitor (~7 dias adicionais)

Empacotar o web app dentro de uma WebView Android. Gera `.apk`/`.aab`, distribui na Play Store, ganha **GPS em background** robusto (essencial para o motorista) e push nativo via FCM em iOS+Android.

**Bibliotecas-chave:**

| Pacote | Para que |
|---|---|
| `@capacitor/core` + `@capacitor/android` | Wrapper nativo |
| `@capacitor/push-notifications` | Push via FCM |
| `@capacitor/geolocation` + `@capacitor-community/background-geolocation` | GPS em background |
| `firebase-admin` (backend) | Enviar push pela FCM |

**Configurações:**

- Projeto no Firebase Console com `applicationId: com.dreamfactory.app`
- `google-services.json` em `apps/web/android/app/`
- `FCM_SERVER_KEY` no `.env` da API
- Keystore para assinar o APK (`keytool -genkey ...`)

**Custos:** Google Play Developer Account = US$ 25 (único, vitalício).

### 10.3. Comparativo

| Aspecto | Fase 1 (PWA + Web Push) | Fase 2 (Capacitor APK) |
|---|---|---|
| Tempo | ~4 dias | +7 dias (acumulado: 11) |
| Instalação | "Adicionar à tela inicial" | APK / Play Store |
| Push Android | ✅ funciona | ✅ via FCM (mais robusto) |
| Push iOS | ⚠️ exige A2HS | ✅ funciona |
| GPS background | ⚠️ limitado | ✅ foreground service |
| Atualização | Instantânea | Via Play Store ou OTA |
| Custos | $0 | $25 (Play Store) |
| Reutiliza código atual | 100% | 100% |

**Recomendação:** começar pela Fase 1. Decidir Fase 2 depois de validar adoção e medir fricção do GPS background do motorista.

---

## 11. Próximos passos sugeridos

- [ ] Migrar `/d` (motorista) para o novo design system
- [ ] Migrar `/admin` (~769 linhas)
- [ ] Migrar `/profile` (~201 linhas)
- [ ] Gerar ícones PWA em vários tamanhos (192×192, 512×512, maskable) a partir do logo
- [ ] HTTPS local para testar GPS no celular via IP (ngrok / cloudflared / mkcert)
- [ ] Trocar `<img>` por `<Image>` do `next/image` nos lugares marcados pelo lint
- [ ] Executar a Fase 1 do plano: PWA + Web Push
- [ ] (Posterior) Executar Fase 2 com Capacitor + FCM se necessário
