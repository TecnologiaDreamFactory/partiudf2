# Sessão 2026-05-22 — Reforma do front (passageiro) + dark mode + correções

> Tudo que foi feito nesta sessão de desenvolvimento, organizado por área.

---

## 1. Subir a aplicação localmente

### 1.1. Banco de dados (MySQL via Docker)

```bash
docker-compose up -d
```

> Na primeira execução baixou a imagem `mysql:8.0`. Container chamado `dreamdriver-mysql`, porta 3306, usuário `root` / senha `root` / banco `dreamdriver`.

### 1.2. Reinstalar dependências (com flag para evitar crash)

O `pnpm install` falhava no postinstall do `bcrypt` em Node 24 com pnpm 9.14.2 (`Error: readStream must be readable`). Workaround:

```bash
pnpm install --ignore-scripts
```

> Cria os symlinks em `.bin` mas pula os postinstall problemáticos.

### 1.3. Gerar Prisma client + aplicar schema

```bash
cd apps/api
node node_modules/prisma/build/index.js db push
node node_modules/prisma/build/index.js generate
```

> Como pulamos scripts, o `prisma generate` não rodou automaticamente — foi feito manualmente.

### 1.4. Patch do Prisma client para Node 24+

Node 24 reproduz o mesmo erro do Node 25 com Prisma 7 (`ERR_PACKAGE_IMPORT_NOT_DEFINED` em `#main-entry-point`). Já existia um script no repo:

```bash
cd apps/api
node prisma/patch-client-node25.js
```

> Substitui `require('#main-entry-point')` por `require('./index.js')` em `node_modules/.pnpm/.../@prisma/client/.prisma/client/default.js`.

### 1.5. Seed (usuários de teste e pontos)

```bash
cd apps/api
NODE_ENV=development node prisma/seed.js
```

Cria:

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@local | 1234 (default) → trocada para **312408** |
| Motorista | driver@local | 123456 |
| Passageiro | p1@local / p2@local | 123456 |

### 1.6. Trocar senha do admin

```bash
cd apps/api
node prisma/set-password.js admin@local 312408
```

> Senha do app é **somente numérica, 4-8 dígitos** (regra em [apps/api/src/auth/password.util.ts:3](../apps/api/src/auth/password.util.ts#L3)).

### 1.7. Subir dev / prod

**Dev (com hot reload):**
```bash
pnpm dev
```

**Prod (sem botão "N" do Next):**
```bash
pnpm --filter @partiudf/web build
pnpm --filter @partiudf/api start &
pnpm --filter @partiudf/web start &
```

URLs:
- Web: <http://localhost:3000>
- API: <http://localhost:3001>

---

## 2. Reforma do front — Style guide PARTIU DF

### 2.1. Tokens de design (CSS variables)

Definidos em [apps/web/src/app/globals.css](../apps/web/src/app/globals.css), expostos no Tailwind via [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts) como `df-*`:

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--df-blue` | `#00A8E8` | `#29B6F0` | Botão primário, links, destaques |
| `--df-blue-dark` | `#0086BD` | `#00A8E8` | Hover/pressed |
| `--df-blue-soft` | `#E6F6FE` | `rgba(0,168,232,0.14)` | Fundo de chip "atual" |
| `--df-ink` | `#0A1929` | `#E2E8F0` | Texto principal |
| `--df-muted` | `#64748B` | `#94A3B8` | Texto secundário |
| `--df-surface` | `#FFFFFF` | `#0F172A` | Fundo de cards |
| `--df-surface-2` | `#F8FAFC` | `#0A1224` | Fundo da página |
| `--df-border` | `#E2E8F0` | `#1F2A44` | Bordas |
| `--df-danger` | `#DC2626` | `#F87171` | Erros / cancelar |
| `--df-success` | `#16A34A` | `#34D399` | OK |
| `--df-warning` | `#D97706` | `#FBBF24` | Atenção |

### 2.2. Dependências instaladas

```bash
pnpm --filter @partiudf/web add \
  class-variance-authority clsx tailwind-merge \
  lucide-react sonner next-themes --ignore-scripts
```

| Pacote | Para que |
|---|---|
| `class-variance-authority` | Variantes tipadas em Button/Badge |
| `clsx` + `tailwind-merge` | Util `cn()` em [apps/web/src/lib/utils.ts](../apps/web/src/lib/utils.ts) |
| `lucide-react` | Ícones (MapPin, Wifi, RefreshCw, Sun/Moon, etc.) |
| `sonner` | Toasts substituindo mensagens inline de erro/sucesso |
| `next-themes` | Light/dark mode com SSR |

### 2.3. Tipografia

- **Body**: Inter (`var(--font-inter)`)
- **Display**: Outfit (`var(--font-outfit)`)

Configurado no [apps/web/src/app/layout.tsx](../apps/web/src/app/layout.tsx) via `next/font/google`.

### 2.4. Componentes (apps/web/src/components/ui/)

| Arquivo | O que faz |
|---|---|
| `Button.tsx` | Variantes `primary`, `ghost`, `outline`, `danger`, `dangerSolid`, `subtle`. Sizes `sm`/`md`/`lg`/`icon`. Suporte a `isLoading`, `fullWidth` (true/false/responsive). |
| `Card.tsx` | + `CardHeader`, `CardTitle`, `CardDescription` |
| `Input.tsx` | Label, `error`, `hint`. Acessibilidade com `aria-describedby` / `aria-invalid`. |
| `Badge.tsx` | Variantes `brand`, `neutral`, `success`, `warning`, `danger`, `live` (com ponto pulsante) |
| `Skeleton.tsx` | Animação shimmer respeitando dark mode |
| `EmptyState.tsx` | Ícone + título + descrição + ação para estados vazios/erro |

### 2.5. Componentes globais

| Arquivo | O que faz |
|---|---|
| [`Logo.tsx`](../apps/web/src/components/Logo.tsx) | Usa o PNG em `public/logo2.png` |
| [`AppShell.tsx`](../apps/web/src/components/AppShell.tsx) | Header sticky com backdrop blur, logo, título, badge, ações e ThemeToggle |
| [`ThemeProvider.tsx`](../apps/web/src/components/ThemeProvider.tsx) | Wrapper do `next-themes` |
| [`ThemeToggle.tsx`](../apps/web/src/components/ThemeToggle.tsx) | Botão sol/lua. **Só claro e escuro** (sem opção "sistema") |
| [`TimeAgo.tsx`](../apps/web/src/components/TimeAgo.tsx) | "Xs / Xmin atrás" com tick interno, **isolado** para não causar re-render da página |

### 2.6. PWA

- [`public/manifest.json`](../apps/web/public/manifest.json) — `name`, `short_name`, `theme_color: #00A8E8`, `display: standalone`
- `<meta theme-color>` no [layout.tsx](../apps/web/src/app/layout.tsx) (variantes claro `#00A8E8` e escuro `#0F172A`)
- `apple-web-app-capable`, viewport `width=device-width`, `viewport-fit=cover` (notch iOS)
- Botões e links em mobile com alvo mínimo **44×44px** (CSS em `globals.css` via `@media (pointer: coarse)`)

### 2.7. Página piloto refatorada — `/p` (passageiro)

[apps/web/src/app/p/page.tsx](../apps/web/src/app/p/page.tsx):

- AppShell com logo + badge de status (live/sinal fraco/aguardando GPS)
- Mensagens de erro/sucesso movidas para **toast** (sonner)
- Skeleton durante carga inicial
- EmptyState para "Nenhuma viagem em andamento"
- Seletor de pickup point como **grid de cards tocáveis** (não mais botões empilhados); ponto atual destacado com glow azul
- "Você está em X" + botão "Cancelar meu check-in" só aparece quando há check-in ativo
- Passageiros agrupados por ponto com chip "você" destacado no nome do usuário atual
- Loading state por botão (mostra spinner só no botão clicado)

---

## 3. Dark mode

- `darkMode: 'class'` no Tailwind
- Tokens viraram CSS variables → componentes não precisam de `dark:` em cada lugar
- `next-themes` controlando `<html class="light|dark">`, com `suppressHydrationWarning` no `<html>`
- `colorScheme: dark` no CSS para form controls nativos seguirem o tema
- Ajustes nos controles do Leaflet (`.leaflet-control-zoom`, atribuição) em dark
- Toggle só alterna entre claro e escuro (removida opção "sistema" a pedido — mantida apenas como **default inicial** ao primeiro acesso)

---

## 4. Correções de UX e bugs

### 4.1. "Salto" da UI durante viagem ativa

**Causa:** `setInterval(forceTick, 1000)` no /p re-renderizava a página inteira a cada segundo. Os textos "Última atualização: Xs atrás" mudavam de largura e os cards mudavam de altura.

**Correção:**
- Removido `forceTick`
- Criado [`<TimeAgo>`](../apps/web/src/components/TimeAgo.tsx) com tick interno
- Criado `LiveOrWeakBadge` (inline no /p) com tick interno
- Criado `MapHud` no [MapView.tsx](../apps/web/src/components/MapView.tsx) com tick interno
- `min-h-[1.25rem]` no `CardDescription` para evitar mudança de altura
- `min-w-[88px]` no badge live/weak para estabilizar largura
- `min-w-[140px]` no HUD do mapa
- `fontVariantNumeric: 'tabular-nums'` no contador de segundos

### 4.2. "Salto" quando não há viagem ativa

**Causa:** `syncStatus()` rodando a cada 4s forçava `setUi('LOADING')` antes do fetch, fazendo a tela piscar entre skeleton ↔ empty state a cada poll.

**Correção:** `syncStatus()` mantém o estado atual durante refresh em background. `LOADING` só aparece no primeiro carregamento. Também usa `setX((prev) => prev.length === 0 ? prev : [])` para não criar novas refs vazias em arrays já vazios.

### 4.3. Botão "N" do Next.js DevTools

**Tentado:**
- `devIndicators: false` em `next.config.ts` — só esconde o badge de rota estática, não o N
- `experimental.devtoolSegmentExplorer: false` — desativa o segment explorer
- `POST /__nextjs_disable_dev_indicator` — desliga server-side por 24h

**Solução real:** o botão **só existe em modo dev**. Em produção (`next start` após `next build`) **não aparece**. Passageiros nunca o veem.

### 4.4. Erro de GPS "1 - Permissão negada"

Vem do browser, não do app (`PERMISSION_DENIED` da Geolocation API). Resolver em:
- Chrome/Edge → ícone de cadeado na URL → Localização → Permitir
- Windows: Configurações → Privacidade e segurança → Localização (ativar + permitir apps de desktop)

Quando acessado por **IP** em outro dispositivo (ex.: celular em `http://192.168.x.x:3000`), o browser bloqueia GPS porque não é HTTPS — precisaria de túnel HTTPS (ngrok/cloudflared) ou certificado local.

### 4.5. Badge "Aguardando viagem" removido

A pedido — agora quando não há viagem ativa, o header fica só com "Passageiro" sem badge.

---

## 5. Sem login obrigatório para passageiro

A pedido — passageiro nunca passa por tela de login.

**Mudanças:**
- [`/` (page.tsx)](../apps/web/src/app/page.tsx) sempre redireciona para `/p`, sem checar role
- [`/p`](../apps/web/src/app/p/page.tsx) sempre renderiza a UI de passageiro. Se localStorage tiver sessão de ADMIN/DRIVER, é **ignorada** e uma sessão de convidado é criada via `ensurePassengerSession()` ([apps/web/src/lib/auth/passengerSession.ts](../apps/web/src/lib/auth/passengerSession.ts))
- Sessão de convidado usa um `guestId` (UUID em `localStorage`) e bate em `POST /auth/passenger-session` no API
- Admin e motorista continuam fazendo login em `/login` → redirecionado a `/admin` ou `/d`

---

## 6. Splash animado com a van (VanLoader)

A pedido — tela de carregamento personalizada com a van da PARTIU DF atravessando a tela antes do app abrir.

**Biblioteca:** [`motion`](https://motion.dev) (Framer Motion v12) — animações React declarativas, hardware-accelerated.

```bash
pnpm --filter @partiudf/web add motion --ignore-scripts
```

**Asset:** `apps/web/public/van.png` (PNG da van PARTIU DF, espelhado por CSS `transform: scaleX(-1)` para apontar na direção certa).

**Componente:** [`apps/web/src/components/VanLoader.tsx`](../apps/web/src/components/VanLoader.tsx)

- Van vai da **direita para a esquerda**, 5.5s por travessia, loop infinito
- Estrada pontilhada azul correndo no sentido oposto (esquerda → direita)
- Três bolinhas pulsando ao lado da mensagem ("Procurando a van…")
- Hardware-accelerated com `will-change: transform / background-position`

### 6.1. Splash gate (mínimo 5s + fade in/out)

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
- Cobre tela inteira em `z-[9999]` (acima de qualquer controle do Leaflet, que usa até z-1000)
- Enquanto `showApp` for falso, **nada** da aplicação é montado:
  - `<AppShell>` não renderiza
  - `<MapView>` não renderiza (mapa não baixa tiles)
  - `useEffect` de polling `syncStatus` (a cada 4s) não dispara
  - `useEffect` de Socket.IO connect/listeners não dispara
  - Endpoint de pickup points não é chamado
- Quando `showApp` flipa para true, a AppShell monta e o splash inicia o fade-out. A aplicação aparece "por baixo" conforme o splash some.

**Em caso de erro de bootstrap**: o splash é ignorado e a tela de erro é renderizada direto, com botão "Tentar novamente".

---

## 7. Arquivos modificados nesta sessão

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
    │   ├── ThemeToggle.tsx                 (NEW — só light/dark, sem opção sistema)
    │   ├── TimeAgo.tsx                     (NEW — isolado)
    │   ├── VanLoader.tsx                   (NEW — splash com van animada via motion)
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
├── sessao-2026-05-22-front-passageiro.md   (este arquivo)
└── plano-apk-notificacoes.md               (NEW — plano técnico para virar APK + push)
```

---

## 8. Próximos passos sugeridos (não implementados)

- Migrar `/d` (motorista) para o novo design system (mesmo padrão de /p)
- Migrar `/admin` (769 linhas)
- Migrar `/profile` (201 linhas)
- Gerar ícones PWA em vários tamanhos (192×192, 512×512, maskable) a partir do logo
- HTTPS local para testar GPS no celular via IP (ngrok / cloudflared / certificado mkcert)
- Otimizar `<img>` → `<Image>` do `next/image` nos lugares marcados pelo lint
- Executar a Fase 1 do plano em [docs/plano-apk-notificacoes.md](./plano-apk-notificacoes.md) — PWA + Web Push para notificações nativas no Android

---

## 9. Plano separado: APK + Notificações

Salvo em [docs/plano-apk-notificacoes.md](./plano-apk-notificacoes.md):

- **Fase 1** (~4 dias): PWA + Web Push — passageiro instala via "Adicionar à tela inicial", recebe push em Android
- **Fase 2** (~7 dias): Capacitor + FCM — APK na Play Store, GPS background do motorista, push nativo iOS+Android
