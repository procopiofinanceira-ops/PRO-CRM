# PRO-CRM

CRM da Procópio Financeira. Projeto independente do CP-Pulse e do Conecta.

## Estrutura

```
PRO-CRM/
  backend/    API Node.js + Express + Prisma + MySQL
  frontend/   React + Vite + Tailwind
  docs/       Documentação e decisões
```

## Stack

| Camada   | Tecnologia                                  |
|----------|---------------------------------------------|
| Backend  | Node.js (ESM), Express, Prisma              |
| Banco    | MySQL 8                                     |
| Frontend | React 18, Vite, Tailwind CSS, React Router  |

Sem robôs de automação (Puppeteer, OCR etc.).

## Como rodar (desenvolvimento)

Pré-requisitos: Node 20+ e MySQL 8 em execução.

```bash
# Backend
cd backend
cp .env.example .env      # preencha DATABASE_URL e JWT_SECRET
npm install
npm run dev               # http://localhost:3000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

## Roadmap (por partes)

1. Esqueleto (concluído)
2. Banco de dados: schema Prisma + migrations + seed (concluído)
3. Autenticação e perfis: Master, Gerente, Supervisor, BKO, Promotor (concluído)
4. Núcleo do CRM: contatos, oportunidades/kanban, produtos, projetos, tarefas, calendário (concluído)
5. Crédito: convênios, margem, simulações, dívidas, importação de planilhas, carteira (concluído)
6. Campanhas, leads de supervisor, envio de leads a promotores, e-mail/SMS marketing, mensagens internas e central de ajuda (concluído)
7. Imobiliário (propostas, documentos, simuladores) e painéis de gestão (concluído)
8. Assistente de IA, notificações e administração: usuários, permissões, acesso por IP do master (concluído)
   Depois: rodada visual (tema tecnológico), área de Bases, modal completo da oportunidade e página de Promotores (concluídos)
9. Opcional, a decidir depois: WhatsApp (disparos e atendente com IA). As tabelas já existem no banco.

## Segurança

Nunca versionar `.env`, senhas ou tokens. Use sempre o `.env.example` como modelo.

Variáveis do backend que merecem atenção em produção:

- `JWT_SECRET`: chave longa e aleatória (o servidor não sobe sem ela).
- `OTP_ENABLED`: `true` liga o código de verificação por e-mail no login (exige `SMTP_*`).
- `TRUST_PROXY`: `1` quando houver nginx na frente da API. Com `0`, o IP vem direto da conexão;
  ligar sem proxy permitiria falsificar o IP e burlar o bloqueio por IP do master.
- `ASSISTENTE_CHAVE`: 64 caracteres hexadecimais que cifram, no banco, as chaves de API do assistente de IA.
  Trocar esse valor exige informar as chaves de novo.
- `CONTROLE_ACESSO_DESLIGADO`: `true` desliga a sessão única e o bloqueio por IP (uso de emergência).
