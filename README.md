# PARTIU DF

Monorepo com pnpm + Turborepo contendo aplicações web (Next.js) e API (NestJS), além de pacotes compartilhados.

## Pré-requisitos

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Docker** — para rodar o banco de dados MySQL ([docker.com](https://docker.com))

## Instalação local (passo a passo)

Execute os comandos abaixo **na ordem** dentro da pasta do projeto:

### 1. Instalar o pnpm

Se você ainda não tem o pnpm instalado:

```bash
npm install -g pnpm
```

### 2. Instalar as dependências

```bash
pnpm i
```

### 3. Copiar o arquivo de variáveis de ambiente

**Windows (PowerShell):**
```powershell
copy .env.example .env
```

**Linux / Mac:**
```bash
cp .env.example .env
```

### 4. Editar o arquivo .env

Abra o arquivo `.env` e confira os valores. Para uso local com Docker:

- **DATABASE_URL** — use `mysql://root:root@localhost:3306/dreamdriver` (senha padrão do docker-compose)
- **JWT_SECRET** — use qualquer string longa para desenvolvimento (ex: `minha-chave-secreta-dev`)

### 5. Subir o banco de dados com Docker

```bash
docker-compose up -d
```

Aguarde 10–15 segundos para o MySQL inicializar. O banco `dreamdriver` é criado automaticamente. Se receber "Connection refused" ao conectar, veja **Solução de problemas**.

### 6. Gerar o Prisma Client

```bash
pnpm --filter @partiudf/api exec prisma generate
```

### 7. Criar as tabelas no banco

```bash
pnpm --filter @partiudf/api exec prisma db push
```

### 8. Compilar o pacote compartilhado

```bash
pnpm --filter @partiudf/shared build
```

### 9. Popular o banco com dados iniciais (recomendado)

Cria usuários de teste e pontos de coleta. Necessário para fazer login na aplicação:

```bash
# Windows (PowerShell) — cria admin + pickup points
$env:NODE_ENV="development"; pnpm --filter @partiudf/api prisma:seed
```

```bash
# Linux / Mac
NODE_ENV=development pnpm --filter @partiudf/api prisma:seed
```

### 10. Rodar o projeto

```bash
pnpm dev
```

Acesse:
- **Web:** http://localhost:3000
- **API:** http://localhost:3001

## Espaço em disco

Depois de `pnpm i` e de rodar `pnpm dev` ou `pnpm build`, a pasta do projeto pode ocupar **cerca de 1 GB** no disco. Isso é esperado e não vem do tamanho do código-fonte versionado:

- **`node_modules/`** (na raiz) — dependências instaladas pelo pnpm (tipicamente centenas de MB a mais de 1 GB). Está listada no `.gitignore` e não é enviada ao repositório remoto.
- **`apps/web/.next/`** — cache e saída de compilação do Next.js. Também ignorada pelo Git.

O Explorador de Arquivos mostra o tamanho **total no disco**, incluindo essas pastas locais.

Para **liberar espaço** (opcional): apague `node_modules` e execute `pnpm i` quando for desenvolver de novo; apague `apps/web/.next` (será recriada ao rodar `dev`/`build`). Se o projeto ficar no OneDrive, pastas muito grandes podem afetar tempo de sincronização e quota.

### O código “funciona” sem `node_modules` e `.next`?

- **Repositório (Git):** sim — o projeto está pensado para **não** versionar `node_modules`, `apps/web/.next` nem `.turbo`. O que define o app são `package.json`, `pnpm-lock.yaml` e o código em `apps/` e `packages/`.
- **Executar na sua máquina:** sem `node_modules` é necessário rodar **`pnpm i`** outra vez antes de `pnpm dev` ou `pnpm build`. É o mesmo fluxo de clonar o repo em outro computador.
- **Cache e build:** `apps/web/.next` e `.turbo` podem ser apagados; o Next.js e o Turborepo os **recriam** ao rodar `dev`/`build`.

Sucesso local também depende de Node 20+ (ver `engines` no `package.json`), pnpm compatível com o campo `packageManager`, rede para baixar pacotes, MySQL/Docker e `.env` — como em qualquer ambiente de desenvolvimento.

---

## Alternativa: usar MariaDB/MySQL já instalado

Se você tem MariaDB ou MySQL rodando (por exemplo, via Docker ou XAMPP), em vez do passo 5:

1. Crie o banco `dreamdriver` no servidor
2. Ajuste o `DATABASE_URL` no `.env` com usuário e senha corretos
3. Continue do passo 6 em diante

## Conexão com DBeaver ou outro cliente MySQL

Para acessar o banco com DBeaver, MySQL Workbench etc.:

| Campo   | Valor      |
|---------|------------|
| Host    | `localhost` ou `127.0.0.1` |
| Porta   | `3306`     |
| Usuário | `root`     |
| Senha   | `root`     |
| Banco   | `dreamdriver` |

**MySQL 8 "Public Key Retrieval":** Adicione à URL de conexão ou nas propriedades do driver: `allowPublicKeyRetrieval=true`

## Solução de problemas

### "Connection refused" ao conectar no banco

O container pode estar sem o mapeamento de porta correto. Recreie-o:

```bash
docker-compose down
docker-compose up -d
```

Aguarde alguns segundos e tente novamente.

### Tabelas vazias ou banco recém-criado

Se recriou o container ou o banco está vazio, execute novamente:

```bash
pnpm --filter @partiudf/api exec prisma db push
$env:NODE_ENV="development"; pnpm --filter @partiudf/api prisma:seed   # Windows
# ou: NODE_ENV=development pnpm --filter @partiudf/api prisma:seed    # Linux/Mac
```

### Erro "Cannot find module '@partiudf/shared'" ao fazer build

O pacote compartilhado precisa ser compilado antes. Execute:

```bash
pnpm --filter @partiudf/shared build
```

Depois rode `pnpm build` ou `pnpm dev` novamente.

### Usuários de teste (após o seed)

| Perfil     | E-mail        | Senha   |
|------------|---------------|---------|
| Admin      | admin@local   | Definida em `SEED_ADMIN_PASSWORD` (padrão: 1234) |
| Motorista  | driver@local  | 123456  |
| Passageiro | p1@local, p2@local | 123456  |

## Estrutura

```
dream-driver/
├── apps/
│   ├── web/          # Next.js (frontend)
│   └── api/          # NestJS (backend)
├── packages/
│   └── shared/       # Tipos e enums compartilhados
├── docker-compose.yml   # MySQL para desenvolvimento
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Scripts

| Comando       | Descrição                           |
| ------------- | ----------------------------------- |
| `pnpm dev`    | Inicia web e api em modo desenvolvimento |
| `pnpm build`  | Build de todos os apps e packages   |
| `pnpm lint`   | Executa lint em todo o monorepo     |
| `pnpm format` | Formata código com Prettier         |

## Apps individuais

```bash
# Rodar apenas a web
pnpm --filter @partiudf/web dev

# Rodar apenas a API
pnpm --filter @partiudf/api dev

# Build do shared (necessário antes de usar em dev)
pnpm --filter @partiudf/shared build
```

## URLs de desenvolvimento

- **Web:** http://localhost:3000
- **API:** http://localhost:3001

## Deploy em staging

Veja [docs/staging.md](docs/staging.md) para configuração em Vercel, API externa (HTTPS) e testes PWA no Android.
