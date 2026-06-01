# Guia: Conectar o Gmail ao CRM (credenciais Google)

Este guia mostra como gerar as credenciais OAuth do Google, necessárias para
o CRM enviar e receber e-mails das suas contas Gmail/Google Workspace.
É um processo de ~10 minutos, feito uma única vez.

## Por que isso é necessário

O Google exige que qualquer aplicativo que acesse o Gmail seja autorizado por
você, o dono das contas. Sem essas credenciais, nenhum sistema consegue ler ou
enviar e-mails — é uma proteção de segurança do próprio Google.

---

## Passo 1 — Criar projeto no Google Cloud

1. Acesse https://console.cloud.google.com/
2. No topo, clique no seletor de projeto → **Novo projeto**
3. Nome: `ITskillTech CRM` → **Criar**

## Passo 2 — Ativar a Gmail API

1. Menu lateral → **APIs e serviços** → **Biblioteca**
2. Busque por **Gmail API** → clique → **Ativar**
3. Volte e busque **Google People API** → **Ativar** (para ler o e-mail do perfil)

## Passo 3 — Configurar a tela de consentimento

1. **APIs e serviços** → **Tela de permissão OAuth**
2. Tipo de usuário: **Externo** → **Criar**
3. Preencha:
   - Nome do app: `ITskillTech CRM`
   - E-mail de suporte: seu e-mail
   - E-mail do desenvolvedor: seu e-mail
4. **Salvar e continuar**
5. Em **Escopos**, clique em "Adicionar escopos" e inclua:
   - `.../auth/gmail.readonly`
   - `.../auth/gmail.send`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
6. **Salvar e continuar**
7. Em **Usuários de teste**, adicione os e-mails das 3 empresas
   (Lottus Tech, IOTA, Splice) — enquanto o app estiver em modo de teste,
   só esses e-mails podem conectar.
8. **Salvar**

## Passo 4 — Criar as credenciais OAuth

1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**
2. Tipo de aplicativo: **Aplicativo da Web**
3. Nome: `ITskillTech CRM Web`
4. Em **URIs de redirecionamento autorizados**, adicione:
   - Para teste local: `http://localhost:3000/api/auth/google/callback`
   - Para produção: `https://SEU-PROJETO.vercel.app/api/auth/google/callback`
     (troque pela URL real depois do deploy na Vercel)
5. **Criar**
6. Copie o **Client ID** e o **Client secret** que aparecerem

## Passo 5 — Configurar no projeto / Vercel

### Local (arquivo .env)
Crie um arquivo `.env` na raiz do projeto (copie de `.env.example`):

```
GOOGLE_CLIENT_ID=cole_aqui_o_client_id
GOOGLE_CLIENT_SECRET=cole_aqui_o_client_secret
NEXTAUTH_URL=http://localhost:3000
TOKEN_SECRET=uma_string_aleatoria_longa_qualquer
```

### Produção (Vercel)
No painel do projeto na Vercel → **Settings** → **Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `GOOGLE_CLIENT_ID` | seu client id |
| `GOOGLE_CLIENT_SECRET` | seu client secret |
| `NEXTAUTH_URL` | https://seu-projeto.vercel.app |
| `TOKEN_SECRET` | uma string aleatória longa |

Depois faça **Redeploy**.

## Passo 6 — Conectar as contas

1. Abra o CRM → **Configurações**
2. Em cada workspace (Lottus Tech, IOTA, Splice), clique em **Conectar**
3. Faça login com a conta Gmail daquela empresa e autorize
4. Pronto — a Caixa de Entrada passa a mostrar os e-mails reais, e você
   pode enviar pela conta conectada.

---

## Observações importantes

- **Modo de teste vs Produção:** enquanto o app estiver "em teste" no Google,
  só os e-mails na lista de usuários de teste conectam. Para liberar geral,
  publique o app (botão na tela de consentimento) — o Google pode pedir
  verificação se você usar escopos sensíveis com muitos usuários.
- **Segurança:** o Client Secret e os tokens NUNCA ficam no código. Ficam só
  nas variáveis de ambiente (servidor) e em cookies criptografados.
- **Receber e-mails:** a Caixa de Entrada lê os e-mails mais recentes via
  Gmail API a cada atualização. Para notificação em tempo real (push),
  é possível evoluir depois com Gmail Watch + Pub/Sub.
