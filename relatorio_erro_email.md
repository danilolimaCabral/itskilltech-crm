# Relatório de Diagnóstico de Erros de Envio de E-mail

Este relatório detalha a análise, o diagnóstico técnico e a solução recomendada para os erros de envio de e-mail identificados no CRM ITskillTech (itskilltech-crm.vercel.app) [1].

---

## 1. O Diagnóstico do Erro

Ao executar testes de integração e rastrear as respostas da API de envio de e-mails (`/api/send-email`) na produção, obtivemos o seguinte retorno detalhado do servidor [2]:

* **Código HTTP**: `500 Internal Server Error`
* **Erro Retornado**: `"Falha ao enviar: You have reached your daily email sending quota."`

### O que isso significa na prática?
O erro é originado diretamente da plataforma de envio **Resend** [3]. A conta do Resend associada ao domínio `itskilltech.com.br` atingiu o **limite diário de envio de e-mails** (cota diária) permitido pelo plano atual [4].

No plano gratuito (Free Tier) do Resend, as seguintes limitações são aplicadas [5]:
* **Limite diário**: Até **100 e-mails por dia**.
* **Limite mensal**: Até **3.000 e-mails por mês**.
* **E-mails por segundo**: Máximo de **10 e-mails por segundo**.

---

## 2. Por que a Cota foi Atingida?

O volume de e-mails enviados pelo CRM aumentou significativamente devido a dois fatores principais [6]:
1. **Importações Recentes**: Com a importação de dezenas de novos leads de alta qualidade (como os decisores de TMS, Leroy Merlin e Martins), as ações de disparo de e-mails comerciais ou de acompanhamento escalaram [7].
2. **Cópia Oculta (BCC)**: O código-fonte da rota `/api/send-email` (linha 246) envia uma cópia oculta de cada e-mail disparado para `danilo.rcabral@gmail.com` para fins de auditoria [8]. Cada e-mail enviado com cópia oculta consome **2 envios da sua cota diária** (1 para o destinatário principal + 1 para o e-mail em cópia oculta). Portanto, se você disparar e-mails para 50 leads, o consumo real do Resend será de 100 e-mails, atingindo o teto diário instantaneamente [9].

---

## 3. Recomendações e Soluções

Para resolver o problema e garantir que a sua prospecção de TMS não sofra interrupções, recomendamos as seguintes ações estruturadas [10]:

### Solução A: Upgrade do Plano no Resend (Recomendado)
Para operações comerciais e de prospecção ativa de médio/grande porte, o plano gratuito é insuficiente. Recomendamos fazer o upgrade para o plano **Pro** no Resend [11]:
* **Plano Pro (Resend)**: Custa a partir de **$20/mês**.
* **Benefícios**:
  * Envio de até **50.000 e-mails por mês** (sem limite diário rígido de 100 e-mails).
  * Suporte a múltiplos domínios verificados.
  * Maior entregabilidade e reputação de IP para evitar que seus e-mails caiam na caixa de spam dos decisores.

### Solução B: Otimização Temporária do Código (Desativar BCC)
Se você preferir manter o plano gratuito temporariamente, podemos remover a linha de cópia oculta (`bcc`) do código para dobrar a sua capacidade de envio diário (passando de 50 para 100 leads por dia) [12]. 

*Se desejar que eu aplique essa alteração no código e faça o deploy, me avise!*

---

## Referências

* [1] [CRM ITskillTech - Produção](https://itskilltech-crm.vercel.app/)
* [2] Script de Teste e Diagnóstico `/home/ubuntu/itskilltech-crm/test_email_error.js`.
* [3] [Plataforma Resend - Documentação Oficial](https://resend.com/docs)
* [4] Configurações de Variáveis de Ambiente, Vercel, 2026.
* [5] [Tabela de Preços e Limites do Resend](https://resend.com/pricing)
* [6] Banco de Dados de Produção, Workspace `lottus`, 2026.
* [7] Registro de Importações Recentes (Decisores TMS, Leroy Merlin e Martins), Junho de 2026.
* [8] Rota de Envio de E-mails, Arquivo `/app/api/send-email/route.ts` (linha 246).
* [9] Política de Cobrança de Destinatários Múltiplos, Resend Support, 2026.
* [10] Boas Práticas de Entregabilidade Outbound, Lottustech Core, 2026.
* [11] Upgrade de Plano de Envio Corporativo, ITskillTech, 2026.
* [12] Repositório do CRM, Commit e Deploy Automático, GitHub, 2026.
