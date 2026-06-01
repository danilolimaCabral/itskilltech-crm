# ITskillTech CRM — versão completa (Gmail integrado)

CRM multicanal em Next.js com integração real ao Gmail (enviar e receber),
gestão de leads, WhatsApp e 3 workspaces (Lottus Tech, IOTA, Splice).

## Recursos

- **Gmail integrado por workspace** — conecta a conta Google de cada empresa
  via OAuth e permite enviar e receber e-mails dentro do CRM
- **Caixa de entrada real** — lê os e-mails via Gmail API
- **Envio real** — manda pela conta conectada (aparece em Enviados no Gmail)
- **Leads** — gestão completa com status, multicanal
- **WhatsApp** — disparo via wa.me
- **Banco opcional** — Vercel Postgres (nuvem) ou modo local (navegador)

## Como rodar localmente

```bash
npm install
cp .env.example .env   # preencha as credenciais Google (veja GUIA_GOOGLE.md)
npm run dev
```

## Deploy na Vercel

1. Suba o projeto para um repositório GitHub
2. Importe em https://vercel.com/new (framework Next.js detectado)
3. Adicione as variáveis de ambiente (veja GUIA_GOOGLE.md)
4. Deploy

## Configurar o Gmail

Siga o **GUIA_GOOGLE.md** — passo a passo para gerar as credenciais OAuth.
Sem isso, o CRM funciona normalmente para leads e WhatsApp, mas a parte de
e-mail fica indisponível até configurar.

## Estrutura

```
app/
  page.tsx                       App principal (Leads, Inbox, Configurações)
  layout.tsx, globals.css
  api/
    auth/google/route.ts         Inicia login Google
    auth/google/callback/route.ts Recebe o callback OAuth
    accounts/route.ts            Lista/desconecta contas
    gmail/send/route.ts          Envia e-mail (Gmail API)
    gmail/inbox/route.ts         Lê a caixa de entrada (Gmail API)
    leads/route.ts               CRUD de leads
    init/route.ts                Inicializa o banco
lib/
  google.ts                      OAuth + clientes Gmail
  accounts.ts                    Armazenamento seguro dos tokens (cookies cripto)
  db.ts                          Banco (Postgres + fallback)
```

## Segurança

- Client Secret e tokens ficam apenas em variáveis de ambiente e cookies
  httpOnly criptografados — nunca no código nem expostos ao navegador.
- `.env` está no .gitignore e não vai para o GitHub.
