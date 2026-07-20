# VOOK Ticket Bot — Central de Atendimento Profissional (Components V2)

Este é um sistema completo, seguro e profissional de gerenciamento de tickets de atendimento para servidores do Discord. Construído com **TypeScript (modo strict)**, **discord.js v14.19+**, **Prisma ORM**, **PostgreSQL** e utilizando exclusivamente a nova API **Components V2** do Discord (sem embeds legados, com separadores nativos, galerias de mídia, text displays e formulários estruturados com labels).

---

## 🚀 Tecnologias Utilizadas

- **Runtime**: Node.js 22+
- **Linguagem**: TypeScript (strict mode)
- **Biblioteca Discord**: Discord.js v14.19.0 ou superior (suporte para Components V2)
- **Banco de Dados**: PostgreSQL (acessado via Prisma ORM)
- **Logger**: Pino (logs estruturados rápidos em formato JSON)
- **Validação**: Zod (validação estrita de variáveis de ambiente e formulários)
- **Deployment**: Docker & Docker Compose

---

## 🛠️ Requisitos de Instalação

Antes de iniciar, certifique-se de ter instalado:
1. **Node.js v22** ou superior.
2. **PostgreSQL** rodando localmente (ou use o Docker Compose).
3. **Git** (opcional, para controle de versão).

---

## 🔧 Configuração no Portal do Desenvolvedor do Discord

Para que o bot funcione corretamente, siga estes passos ao criar o bot no [Discord Developer Portal](https://discord.com/developers/applications):

1. **Intents Privilegiados**: Na aba **Bot**, ative os seguintes intents:
   - **Presence Intent** (opcional)
   - **Server Members Intent** (obrigatório: para buscar cargos e membros de equipe)
   - **Message Content Intent** (obrigatório: necessário para ler o histórico do canal e gerar transcripts)

2. **Permissões do Link de Convite**: Convide o bot para o seu servidor com as seguintes permissões básicas:
   - **Gerenciar Canais** (`Manage Channels`)
   - **Gerenciar Cargos** (`Manage Roles`)
   - **Ver Canais** (`View Channels`)
   - **Enviar Mensagens** (`Send Messages`)
   - **Gerenciar Mensagens** (`Manage Messages`)
   - **Ler Histórico de Mensagens** (`Read Message History`)
   - **Inserir Links** (`Embed Links`)
   - **Anexar Arquivos** (`Attach Files`)

---

## 📝 Configurando as Variáveis de Ambiente (.env)

Crie um arquivo chamado `.env` na raiz do projeto (use o `.env.example` como referência) e configure as variáveis:

```env
# Credenciais do Discord
DISCORD_TOKEN=seu_token_aqui
DISCORD_CLIENT_ID=id_da_sua_aplicacao_aqui
DEVELOPER_GUILD_ID=id_do_seu_servidor_de_testes_aqui
BOT_FOUNDER_IDS=id_do_fundador_1,id_do_fundador_2

# Banco de Dados
DATABASE_URL=postgresql://postgres:senha@localhost:5432/vook_tickets?schema=public

# Redis (Opcional - Se fornecido, gerencia locks distributivos. Caso contrário, usa Map em memória)
REDIS_URL=redis://localhost:6379

# Configurações de Transcript
TRANSCRIPT_STORAGE_MODE=local # "local" ou "s3"
TRANSCRIPT_LOCAL_PATH=./data/transcripts

# Cloudflare R2 / S3 (Apenas se TRANSCRIPT_STORAGE_MODE for "s3")
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=seu-bucket-de-transcripts
S3_ACCESS_KEY_ID=sua_access_key
S3_SECRET_ACCESS_KEY=sua_secret_key
S3_PUBLIC_BASE_URL=https://transcripts.suadominio.com

# Ambiente e Logs
LOG_LEVEL=info
NODE_ENV=development
```

---

## 📦 Execução Local (Passo a Passo)

### 1. Instalar as dependências
```bash
npm install
```

### 2. Rodar Migrations e Seeds do Banco de Dados
Crie as tabelas no banco de dados e insira as três categorias padrão (**Orçamento**, **Dúvidas**, **Parcerias**) executando:
```bash
# Executa as migrations do Prisma
npx prisma migrate dev --name init

# Executa o script de Seed para criar as categorias padrão
npm run db:seed
```

### 3. Registrar Comandos Slash
Registre os comandos do bot no seu servidor de testes (usando o `DEVELOPER_GUILD_ID` definido no `.env`) ou globalmente:
```bash
npm run commands:deploy
```
*(Nota: Para limpar comandos cadastrados, utilize `npm run commands:delete`)*.

### 4. Iniciar o Bot em Desenvolvimento
```bash
npm run dev
```

---

## 🐳 Executando com Docker (Recomendado)

O projeto inclui um setup Docker completo composto por banco de dados PostgreSQL e a aplicação do bot.

1. Configure o `.env` na raiz do projeto (o Docker lerá as configurações dele).
2. Construa e inicie os containers em segundo plano:
```bash
docker-compose up -d --build
```
3. A imagem executará automaticamente as migrations pendentes e iniciará o bot em modo de produção. Os logs estruturados podem ser monitorados com:
```bash
docker logs -f vook-bot
```

---

## ⚙️ Guia de Configuração no Discord (Fundador)

Todos os comandos de administração exigem que o usuário seja um dos cadastrados no `BOT_FOUNDER_IDS` do `.env`.

### Passo 1: Configurar Canais e Banners gerais
Execute o comando `/ticket-config geral`. Um painel administrativo ephemeral será enviado contendo o status geral do sistema.
1. Clique em **Configurar canais**.
2. Selecione o canal onde o painel público será enviado.
3. Selecione o canal de logs onde os logs e transcripts serão enviados.
4. Clique em **Editar visual** para alterar o título, descrição e logo/banner.

### Passo 2: Configurar Destinos das Categorias
Os canais de atendimento precisam ser criados dentro de categorias físicas do Discord.
1. Execute `/ticket-destinos configurar`.
2. Selecione a categoria lógica (ex: **Orçamento**).
3. Selecione a categoria de canal correspondente do Discord.
4. Repita para todas as categorias ativas.

### Passo 3: Configurar a Equipe de Atendimento
1. Execute `/ticket-equipe configurar`.
2. Selecione a categoria lógica (ex: **Orçamento**).
3. Selecione um ou mais cargos do Discord que pertencerão à equipe e poderão responder a esses tickets.

### Passo 4: Enviar o Painel Público de Abertura
1. Com tudo configurado, execute `/ticket-painel enviar`.
2. O bot enviará o painel no canal configurado.
3. Se você fizer modificações em categorias ou banners, execute `/ticket-painel atualizar` para sincronizar a mensagem pública sem duplicá-la.

---

## 📁 Fluxo de Atendimento do Usuário

1. **Escolha da Categoria**: O cliente seleciona a categoria desejada no dropdown do painel público.
2. **Modal de Assunto**: Um modal Components V2 abre exigindo que o usuário informe o assunto do contato (mínimo de 5 caracteres, sem menções ou quebras de linha).
3. **Criação do Canal**: O bot valida os limites e cria um canal de texto privado no destino correto.
4. **Painel do Ticket**: O bot envia o painel interno com 4 botões administrativos (Assumir, Painel Admin, Notificar Cliente, Finalizar).
5. **Ações de Equipe**:
   - **Assumir**: Seta o atendente e altera o status.
   - **Painel Admin (Invisible)**: Permite adicionar membros temporários, remover participantes e renomear o canal.
   - **Notificar**: Envia aviso no canal e uma mensagem direta (DM) no privado do cliente.
   - **Finalizar**: Solicita o preenchimento de um relatório de conclusão e fecha o ticket, salvando o transcript HTML, enviando DM para o cliente e disparando o log estruturado no canal de logs antes de deletar ou arquivar o canal.
