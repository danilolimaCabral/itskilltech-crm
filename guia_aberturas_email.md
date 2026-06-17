# Manual do Usuário: Como Rastrear e Ver as Aberturas de E-mail no CRM

Este guia prático explica como o sistema de rastreamento inteligente de e-mails funciona no CRM ITskillTech (itskilltech-crm.vercel.app) e como você pode identificar visualmente quando um lead abriu o seu e-mail [1].

---

## 1. Como o CRM Rastreia as Aberturas de E-mail

Toda vez que você envia um e-mail pelo CRM, o sistema insere de forma totalmente invisível e automática um **pixel de rastreamento transparente de 1x1** no rodapé da mensagem [2]. 

Quando o destinatário (o decisor de TI ou Logística) abre o e-mail no leitor dele (Gmail, Outlook, celular, etc.), o leitor carrega essa imagem invisível do nosso servidor [3]. No milissegundo em que o servidor recebe essa requisição, o CRM executa as seguintes ações automáticas em tempo real [4]:

1. **Atualiza a Etapa do Funil**: O lead é movido de forma automática para a etapa **"E-mail Aberto"** no seu Kanban [5].
2. **Registra na Timeline**: Um evento com o selo `📬 E-mail aberto pelo destinatário em [Data/Hora]` é gravado na aba **Histórico** do lead [6].
3. **Dispara um Follow-up Inteligente (Opcional)**: Se o lead estiver nas etapas de prospecção e abrir o e-mail, o CRM dispara um segundo e-mail de acompanhamento automático ("follow-up") após alguns minutos para fisgar a atenção dele no momento exato em que ele está lendo sobre a sua solução [7]!

---

## 2. Como Ver Quem Abriu o E-mail (3 Formas Visuais)

Você pode identificar facilmente quem abriu os seus e-mails por meio de três áreas distintas no CRM [8]:

### A. Pelo Painel do Kanban (Etapa "E-mail Aberto")
No seu quadro de prospecção, há uma coluna chamada **"E-mail Aberto"** (ou status equivalente) [9]. 
* **O que acontece**: Assim que o cliente abre o e-mail, o card dele se move sozinho para essa coluna.
* **Benefício**: Você sabe instantaneamente, apenas batendo o olho no Kanban, quais leads estão interagindo ativamente com as suas mensagens.

### B. Pela Aba "Histórico" (Timeline) do Lead
Ao clicar no card do lead para abrir o painel lateral de detalhes [10]:
1. Acesse a aba **"Histórico"** (Timeline).
2. Você verá um balão de evento destacado com um emoji de caixa de correio:
   > 📬 **E-mail aberto pelo destinatário em 16/06/2026 às 15:30:12**
3. Logo abaixo, se o follow-up automático tiver sido disparado, você verá:
   > 📧 **Follow-up automático enviado: "Você tem interesse?"**

### C. Pela Tela de "E-mails Enviados"
No menu lateral esquerdo do CRM, ao clicar em **"Enviados"** [11]:
* Você verá uma tabela com todos os e-mails disparados.
* Há uma coluna de status de leitura que exibe um selo verde **"Aberto"** ou cinza **"Enviado"** para cada mensagem, permitindo que você audite o sucesso das suas campanhas de e-mail de forma global.

---

## 3. Exemplo Prático do Fluxo de Rastreamento

| Ação do Usuário (Danilo) | Ação do Lead (Decisor) | Reação Automática do CRM | Próximo Passo Comercial |
| :--- | :--- | :--- | :--- |
| **1. Envia e-mail de apresentação** | Recebe na caixa de entrada | Nenhuma alteração (status: *Qualificação*) | Aguardar abertura |
| **2. Monitora o CRM** | **Abre o e-mail para ler** | **Move o card para "E-mail Aberto"** + **Grava na Timeline** | **Oportunidade Quente!** |
| **3. Acompanhamento** | Recebe o follow-up automático | Dispara e-mail: *"Vi que você deu uma olhada..."* | Entrar em contato via WhatsApp ou Ligar |

---

## 4. Dicas de Ouro para Melhorar a Taxa de Abertura

Para garantir que o pixel funcione perfeitamente e que os decisores abram os seus e-mails [12]:
* **Assuntos Curtos e Instigantes**: Use assuntos personalizados com o nome do lead e da empresa. Ex: *"Apresentação getLOG — Solução TMS para a Leroy Merlin"* [13].
* **Evite Spam**: Não envie e-mails em massa repetitivos para a mesma conta no mesmo dia (o CRM bloqueia envios duplicados no mesmo dia para proteger a reputação do seu domínio) [14].
* **WhatsApp como Segundo Passo**: Assim que ver o card do lead se mover para "E-mail Aberto", aproveite o momento quente para clicar no botão de WhatsApp do card e enviar uma mensagem rápida!

---

## Referências

* [1] [CRM ITskillTech - Produção](https://itskilltech-crm.vercel.app/)
* [2] Rota de Pixel de Rastreamento, Arquivo `/app/api/track-email/route.ts` (linhas 4-8).
* [3] Protocolo de Requisições HTTP GET, IETF RFC 7231, 2026.
* [4] Manipulação de Eventos e Estado de Leads, Vercel Postgres SQL, 2026.
* [5] Atualização de Status de Leads para 'email_aberto', Arquivo `/app/api/track-email/route.ts` (linhas 24-31).
* [6] Histórico de Eventos na Timeline, Arquivo `/app/api/track-email/route.ts` (linhas 32-58).
* [7] Disparo de Follow-up Automático via Resend, Arquivo `/app/api/track-email/route.ts` (linhas 65-152).
* [8] Componentes de Interface do Usuário, Arquivo `/app/page.tsx`.
* [9] Mapeamento de Colunas do Funil Kanban, Arquivo `/app/page.tsx` (linhas 1117-1119).
* [10] Painel Lateral de Detalhes do Lead, Arquivo `/app/page.tsx` (linhas 1275-1351).
* [11] Tela de E-mails Enviados (SentEmailsView), Arquivo `/app/page.tsx` (linha 1240).
* [12] Boas Práticas de Entregabilidade de E-mail Outbound, getLOG, 2026.
* [13] Templates de E-mail de Apresentação Getlog, Arquivo `/app/page.tsx` (linhas 1600-1647).
* [14] Validação de Duplicidade Diária de E-mails, Arquivo `/app/page.tsx` (linhas 451-459).
