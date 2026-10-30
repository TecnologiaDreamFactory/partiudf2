# Plano — Transformar PARTIU DF em APK + Notificações Push

> Plano técnico para que o app possa (1) ser instalado como aplicativo no celular (incluindo APK na Play Store) e (2) enviar notificações push para dispositivos com ele instalado.

---

## Contexto

Hoje o app é um **Next.js** (web) + **NestJS** (API). Já é mobile-first, tem manifest PWA básico e `theme-color`. Falta:

- Push notifications real (Web Push e/ou FCM)
- Service worker próprio (Next por padrão não gera um para push)
- Ícones em múltiplos tamanhos
- Empacotamento opcional como APK nativo

---

## Estratégia: 2 fases

### Fase 1 — PWA + Web Push (passageiros)
Caminho mais curto, sem Play Store. Passageiros instalam pelo Chrome Android ("Adicionar à tela inicial"). Notificações funcionam mesmo com o app fechado em Android. iOS exige adicionar à tela inicial (iOS 16.4+).

### Fase 2 — APK nativo via Capacitor (opcional)
Empacotar o web app dentro de uma WebView Android. Gera `.apk`/`.aab`, distribui na Play Store, ganha **GPS em background** robusto (essencial para o motorista) e push nativo via FCM.

> Decidir Fase 2 depois de validar Fase 1 com usuários reais.

---

## Fase 1 — PWA + Web Push

### 1.1. Pré-requisitos

- **HTTPS em produção** (sem isso, Push API não funciona). Localhost também funciona em dev.
- **Chaves VAPID** (geradas uma vez com `npx web-push generate-vapid-keys`):
  - `VAPID_PUBLIC_KEY` → frontend
  - `VAPID_PRIVATE_KEY` → backend (`.env`)

### 1.2. Ícones PWA

Gerar a partir do `apps/web/public/logo2.png`:

| Arquivo | Tamanho | Uso |
|---|---|---|
| `icon-192.png` | 192×192 | Android |
| `icon-512.png` | 512×512 | Splash |
| `icon-maskable-192.png` | 192×192 com padding | Android adaptive |
| `icon-maskable-512.png` | 512×512 com padding | Android adaptive |
| `apple-touch-icon.png` | 180×180 | iOS |
| `favicon.ico` | 32×32 | Aba do browser |

Ferramenta: <https://realfavicongenerator.net> ou `pnpm dlx @vite-pwa/assets-generator`.

Atualizar [`apps/web/public/manifest.json`](../apps/web/public/manifest.json) com os caminhos novos + `purpose: "maskable"`.

### 1.3. Service Worker (push handler)

Criar `apps/web/public/sw.js`:

```js
// Receber push do servidor
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'PARTIU DF', body: '' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url ? { url: data.url } : undefined,
      vibrate: [200, 100, 200],
    }),
  );
});

// Click → abrir/focar a aba
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((wins) => {
      const target = wins.find((w) => w.url.includes(url));
      return target ? target.focus() : clients.openWindow(url);
    }),
  );
});
```

Registrar em um componente cliente (ex.: dentro do `AppShell` ou em `layout.tsx` com `<Script>`):

```ts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### 1.4. Frontend — fluxo de inscrição

Criar `apps/web/src/lib/push.ts`:

```ts
export async function subscribePush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  });

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });

  return sub;
}
```

UI: botão "🔔 Ativar notificações" na página `/p` (visível enquanto a permissão for `default`). Esconde se já estiver `granted` ou `denied`.

### 1.5. Backend — armazenar subscriptions e enviar

**Schema Prisma** novo:

```prisma
model PushSubscription {
  id           String   @id @default(cuid())
  userId       String?
  guestId      String?
  endpoint     String   @unique
  p256dh       String
  auth         String
  userAgent    String?
  createdAt    DateTime @default(now())

  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([guestId])
}
```

**Dependências:**

```bash
pnpm --filter @partiudf/api add web-push
pnpm --filter @partiudf/api add -D @types/web-push
```

**Endpoint Nest** (`apps/api/src/push/push.controller.ts`):

```ts
@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Body() body: PushSubscriptionDto, @CurrentUser() user: AuthUser) {
    return this.push.saveSubscription(user.id, body);
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard)
  unsubscribe(@Body('endpoint') endpoint: string) {
    return this.push.removeSubscription(endpoint);
  }
}
```

**Service** com `web-push.sendNotification(subscription, JSON.stringify(payload))`. Tratar erro 410 (gone) removendo a subscription do banco.

### 1.6. Gatilhos de notificação

Inserir no fluxo existente:

| Evento | Quem recebe | Payload |
|---|---|---|
| `trip.started` | Todos passageiros inscritos | "Uma nova viagem começou" + URL `/p` |
| `trip.ended` | Passageiros com check-in nessa viagem | "A viagem foi finalizada" |
| `van.approaching` (a 200m do ponto) | Passageiros com check-in nesse ponto | "A van está chegando ao seu ponto" |
| Mensagem custom do admin (`/admin/broadcast`) | Todos | Texto livre |

O cálculo de "van se aproximando" vive no `RealtimeGateway` quando processa `trip.location`.

### 1.7. Estimativa Fase 1

| Tarefa | Tempo |
|---|---|
| Ícones + manifest atualizado | 0.5 dia |
| Service worker + registro | 0.5 dia |
| Lib push.ts + UI de inscrição | 0.5 dia |
| Migração Prisma + endpoint Nest | 0.5 dia |
| PushService + integração `web-push` | 0.5 dia |
| Gatilhos (trip.started, approaching) | 1 dia |
| Testes em Android real + ajustes | 0.5 dia |
| **Total** | **~4 dias úteis** |

---

## Fase 2 — APK nativo via Capacitor

### 2.1. Quando faz sentido

- Precisa GPS em background confiável para o motorista (browsers Android matam a aba após alguns minutos)
- Quer estar na Play Store (busca, branding, atualização automática)
- Quer notificações em iOS sem exigir "Adicionar à tela inicial"
- Quer usar APIs nativas (biometria, NFC, contatos)

### 2.2. Como funciona

[Capacitor](https://capacitorjs.com) embrulha o web em uma WebView Android/iOS. O HTML/CSS/JS continua o mesmo. Acesso a APIs nativas vem por plugins JavaScript.

**Modos:**
- **Bundled** (`output: 'export'` no Next): app empacota HTML estático. Sem SSR. Mais leve, funciona offline.
- **Remote**: WebView aponta para URL HTTPS hospedada. Mantém SSR. Precisa de internet.

> Para o PARTIU DF provavelmente **modo remote** é mais simples (não obriga refatorar o Next para export).

### 2.3. Setup inicial

```bash
pnpm --filter @partiudf/web add @capacitor/core @capacitor/android
pnpm --filter @partiudf/web add -D @capacitor/cli
cd apps/web
npx cap init "PARTIU DF" com.dreamfactory.app --web-dir=public
npx cap add android
```

`capacitor.config.ts`:

```ts
{
  appId: 'com.dreamfactory.app',
  appName: 'PARTIU DF',
  webDir: 'public',  // se modo bundled
  server: {
    url: 'https://app.dreamfactory.com.br',  // se modo remote
    cleartext: false,
  },
}
```

### 2.4. Push nativo via FCM

```bash
pnpm --filter @partiudf/web add @capacitor/push-notifications
npx cap sync android
```

**Configuração:**
1. Criar projeto no [Firebase Console](https://console.firebase.google.com), adicionar app Android com `applicationId: com.dreamfactory.app`
2. Baixar `google-services.json` → colocar em `apps/web/android/app/`
3. Adicionar plugin Google Services no Gradle (Capacitor doc cobre)
4. Obter **Server Key (FCM)** → guardar no backend como `FCM_SERVER_KEY`

**Frontend** (substitui o `push.ts` da Fase 1 quando rodando no APK):

```ts
import { PushNotifications } from '@capacitor/push-notifications';

await PushNotifications.requestPermissions();
await PushNotifications.register();

PushNotifications.addListener('registration', ({ value: fcmToken }) => {
  fetch('/api/push/register-fcm', {
    method: 'POST',
    body: JSON.stringify({ token: fcmToken }),
  });
});
```

**Backend:** novo endpoint que armazena `FcmToken` (modelo separado de `PushSubscription` web). Service usa SDK do `firebase-admin` para enviar.

```bash
pnpm --filter @partiudf/api add firebase-admin
```

```ts
import * as admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
await admin.messaging().send({
  token: fcmToken,
  notification: { title, body },
  data: { url: '/p' },
});
```

### 2.5. GPS em background (motorista)

Para a tela do motorista (`/d`), trocar `navigator.geolocation.watchPosition` por:

```bash
pnpm --filter @partiudf/web add @capacitor/geolocation
```

```ts
import { Geolocation } from '@capacitor/geolocation';
await Geolocation.requestPermissions();
const id = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos) => {
  socket.emit('trip.location', { ... });
});
```

E adicionar plugin específico para **foreground service** (notificação persistente "Compartilhando localização") — exigência do Android 10+:

```bash
pnpm --filter @partiudf/web add @capacitor-community/background-geolocation
```

Configurar `AndroidManifest.xml` com permissões `ACCESS_BACKGROUND_LOCATION` e `FOREGROUND_SERVICE_LOCATION`.

### 2.6. Build do APK

```bash
cd apps/web/android
./gradlew assembleRelease
```

Gera `apps/web/android/app/build/outputs/apk/release/app-release.apk`.

**Para Play Store** (`.aab`):

```bash
./gradlew bundleRelease
```

Precisa de **keystore** para assinar (gerar com `keytool -genkey ...`) e guardar a senha em local seguro (perda = não consegue atualizar o app).

### 2.7. Detectar plataforma no código

```ts
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // usa @capacitor/push-notifications
} else {
  // usa Web Push
}
```

Assim o mesmo código roda no browser e no APK escolhendo o caminho de push apropriado.

### 2.8. Estimativa Fase 2

| Tarefa | Tempo |
|---|---|
| Setup Capacitor + Android Studio | 1 dia |
| Modo remote/bundled definido + funcionando | 0.5 dia |
| FCM (Firebase + plugin + backend) | 1.5 dias |
| GPS background do motorista | 1.5 dias |
| Splash screen, ícones nativos, status bar | 0.5 dia |
| Build + assinatura + teste em devices reais | 1 dia |
| Submit Play Store (conta + descrição + screenshots) | 1 dia |
| **Total** | **~7 dias úteis** |

Custos adicionais: **Google Play Developer Account = US$ 25** (único, vitalício).

---

## Sumário executivo

| Aspecto | Fase 1 (PWA + Web Push) | Fase 2 (Capacitor APK) |
|---|---|---|
| Tempo | ~4 dias | +7 dias (acumulado: 11) |
| Instalação | "Adicionar à tela inicial" | APK / Play Store |
| Push Android | ✅ funciona | ✅ via FCM (mais robusto) |
| Push iOS | ⚠️ exige A2HS | ✅ funciona |
| GPS background | ⚠️ limitado (browser mata) | ✅ foreground service |
| Atualização do app | Instantânea (recarrega URL) | Via Play Store ou OTA |
| Custos | $0 | $25 (Play Store) |
| Reutiliza código atual | 100% | 100% |

**Recomendação:** começar pela Fase 1 (entrega rápido valor para passageiros). Decidir Fase 2 depois de validar adoção e medir a fricção de GPS background do motorista.

---

## Pendências antes de começar

- [ ] Confirmar domínio HTTPS de produção (necessário para Web Push)
- [ ] Gerar chaves VAPID e adicionar no `.env`
- [ ] Definir gatilhos de notificação que importam (trip.started, approaching, etc.)
- [ ] Definir se Fase 2 acontece (decide se compra conta Play Store)
- [ ] Se Fase 2: criar projeto Firebase + gerar `google-services.json`
