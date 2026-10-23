import 'dotenv/config';
// Faz o Express 4 encaminhar erros de rotas assíncronas ao tratador de erros (sem isso, derrubam o servidor)
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import {
  contatos,
  oportunidades,
  produtos,
  observacoes,
  eventos,
  projetos,
  tarefas,
  dashboard,
} from './routes/crm.routes.js';
import {
  convenios,
  conveniosCompletos,
  conveniosControle,
  inconsistencias,
  margens,
  solicitacoesMargem,
  simulacoes,
  dividas,
  carteira,
} from './routes/credito.routes.js';
import { importacoes, leads } from './routes/importacoes.routes.js';
import { campanhas, favoritos } from './routes/campanhas.routes.js';
import imobiliarioRoutes from './routes/imobiliario.routes.js';
import painelRoutes from './routes/painel.routes.js';
import notificacoesRoutes from './routes/notificacoes.routes.js';
import acessoRoutes from './routes/acesso.routes.js';
import assistenteRoutes from './routes/assistente.routes.js';
import basesRoutes from './routes/bases.routes.js';
import buscaRoutes from './routes/busca.routes.js';
import promotoresRoutes from './routes/promotores.routes.js';
import {
  emailMarketing,
  smsMarketing,
  timesAjuda,
  chamados,
  canais,
} from './routes/comunicacao.routes.js';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.startsWith('troque-')) {
  console.error('FATAL: defina um JWT_SECRET forte no .env.');
  process.exit(1);
}

const app = express();

// Só confie em X-Forwarded-For se houver um proxy de verdade na frente (nginx): TRUST_PROXY=1.
// Sem proxy, confiar nele deixaria qualquer um falsificar o IP (e burlar a trava por IP).
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy === undefined ? 0 : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(rateLimit({ windowMs: 60_000, limit: 300 }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pro-crm-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/contatos', contatos);
app.use('/api/oportunidades', oportunidades);
app.use('/api/produtos', produtos);
app.use('/api/observacoes', observacoes);
app.use('/api/eventos', eventos);
app.use('/api/projetos', projetos);
app.use('/api/projetos/:projetoId/tarefas', tarefas);
app.use('/api/dashboard', dashboard);
app.use('/api/convenios', convenios);
app.use('/api/convenios-completos', conveniosCompletos);
app.use('/api/convenios-controle', conveniosControle);
app.use('/api/inconsistencias', inconsistencias);
app.use('/api/margens', margens);
app.use('/api/solicitacoes-margem', solicitacoesMargem);
app.use('/api/simulacoes', simulacoes);
app.use('/api/dividas', dividas);
app.use('/api/carteira', carteira);
app.use('/api/importacoes', importacoes);
app.use('/api/leads', leads);
app.use('/api/campanhas', campanhas);
app.use('/api/leads-favoritos', favoritos);
app.use('/api/email-marketing', emailMarketing);
app.use('/api/sms-marketing', smsMarketing);
app.use('/api/times-ajuda', timesAjuda);
app.use('/api/chamados', chamados);
app.use('/api/canais', canais);
app.use('/api/imobiliario', imobiliarioRoutes);
app.use('/api/painel', painelRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/acesso', acessoRoutes);
app.use('/api/assistente', assistenteRoutes);
app.use('/api/bases', basesRoutes);
app.use('/api/busca', buscaRoutes);
app.use('/api/promotores', promotoresRoutes);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

process.on('unhandledRejection', (motivo) => console.error('Promessa rejeitada sem tratamento:', motivo));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PRO-CRM backend rodando em http://localhost:${PORT}`);
});
