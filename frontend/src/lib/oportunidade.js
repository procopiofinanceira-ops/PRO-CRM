// Constantes e conversões compartilhadas pelas telas de oportunidades e de promotores.

export const ESTAGIOS = [
  { valor: 'novo', rotulo: 'Novo', cor: 'bg-slate-400', stroke: 'stroke-slate-400' },
  { valor: 'contactando', rotulo: 'Contactando', cor: 'bg-sky-500', stroke: 'stroke-sky-500' },
  { valor: 'segundo_dia', rotulo: '2º dia', cor: 'bg-amber-500', stroke: 'stroke-amber-500' },
  { valor: 'terceiro_dia', rotulo: '3º dia', cor: 'bg-orange-500', stroke: 'stroke-orange-500' },
  { valor: 'em_tratativa', rotulo: 'Em tratativa', cor: 'bg-fuchsia-500', stroke: 'stroke-fuchsia-500' },
  { valor: 'proposta', rotulo: 'Proposta', cor: 'bg-violet-500', stroke: 'stroke-violet-500' },
  { valor: 'ganhamos', rotulo: 'Ganhamos', cor: 'bg-emerald-500', stroke: 'stroke-emerald-500' },
  { valor: 'perdemos', rotulo: 'Perdido', cor: 'bg-primary', stroke: 'stroke-primary' },
];

export const ROTULO_ESTAGIO = Object.fromEntries(ESTAGIOS.map((e) => [e.valor, e.rotulo]));

// Estágios que exigem receita esperada (o servidor também confere)
export const ESTAGIOS_COM_RECEITA = new Set(['em_tratativa', 'proposta', 'ganhamos']);

export const MOTIVOS_PERDA = [
  'Taxa muito alta',
  'Sem regras para o escritório',
  'Não aprovado pelo banco',
  'Sem margem consignável disponível',
  'Margem presa',
  'Cliente recusou a oferta',
  'Os telefones não pertencem ao cliente',
  'Após 3 dias de tentativas, 4 vezes por dia, o cliente não atende',
  'O promotor não tem interesse',
  'Não trabalha na empresa',
  'Não quer ser contactado para venda',
  'Cliente cadastrado no "não perturbe"',
  'Cliente não está elegível',
  'Prospecto sem telefone no cadastro',
  'Inação: sem ação do promotor por mais de 10 dias',
];

/** Cor de cada estágio nos selos (cartões, tabelas). */
export const CLASSE_ESTAGIO = {
  novo: 'bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30',
  contactando: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  segundo_dia: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  terceiro_dia: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  em_tratativa: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30',
  proposta: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30',
  ganhamos: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  perdemos: 'bg-primary/15 text-primary border-primary/30',
};

/** WhatsApp: acrescenta o 55 do Brasil quando falta. */
export function numeroWhatsApp(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (digitos.length < 10) return null;
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
}

/** O retorno agendado já venceu (hoje ou antes) e a oportunidade segue aberta? */
export function retornoVencido(op) {
  if (!op.dataRetorno || ['ganhamos', 'perdemos'].includes(op.estagio)) return false;
  // Data local (en-CA = AAAA-MM-DD), não UTC: à noite o dia em UTC já virou
  return op.dataRetorno.slice(0, 10) <= new Date().toLocaleDateString('en-CA');
}
