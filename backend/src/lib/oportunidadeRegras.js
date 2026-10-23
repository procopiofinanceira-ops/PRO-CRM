import { prisma } from './prisma.js';
import { erroHttp } from './crud.js';

// Regras e histórico das oportunidades. O histórico é montado aqui, no servidor,
// para que ninguém consiga forjar entradas pelo navegador.

export const ESTAGIOS_ROTULO = {
  novo: 'Novo',
  contactando: 'Contactando',
  segundo_dia: '2º dia de contato',
  terceiro_dia: '3º dia de contato',
  em_tratativa: 'Em tratativa',
  proposta: 'Proposta',
  ganhamos: 'Ganhamos',
  perdemos: 'Perdido',
};

// Nesses estágios a receita esperada é obrigatória
const ESTAGIOS_COM_RECEITA = new Set(['em_tratativa', 'proposta', 'ganhamos']);
const MAX_ATIVIDADES = 300;

const CAMPOS = {
  nome: 'Nome',
  cpf: 'CPF',
  empresa: 'Convênio',
  telefone: 'Celular',
  email: 'E-mail',
  produto: 'Produto',
  valor: 'Valor',
  descricao: 'Observações',
  receitaEsperada: 'Receita esperada',
  dataRetorno: 'Data de retorno',
  horaRetorno: 'Hora de retorno',
  prioridade: 'Prioridade',
  cidade: 'Cidade',
  motivoPerda: 'Motivo da perda',
};

const DETALHES = {
  outros_telefones: 'Outros telefones',
  nascimento: 'Nascimento',
  idade: 'Idade',
  matricula: 'Matrícula',
  tipo_servidor: 'Tipo de servidor',
  codigo_convenio: 'Cód. do convênio',
  campanha: 'Campanha',
  data_beneficio: 'Data do benefício',
  meio_pagamento: 'Meio de pagamento',
  banco: 'Banco',
  ag_banco: 'Agência',
  conta_corrente: 'Conta corrente',
  numero_contrato: 'Nº do contrato',
  valor_parcela: 'Valor da parcela',
  qtd_parcelas_total: 'Parcelas: total',
  qtd_parcelas_pagas: 'Parcelas: pagas',
  qtd_parcelas_futuras: 'Parcelas: futuras',
  qtd_parcelas_vencidas: 'Parcelas: vencidas',
  taxa_mes: 'Taxa ao mês',
  saldo_devedor: 'Saldo devedor',
};
for (const [pref, nome] of [['emp', 'Empréstimo'], ['rmc', 'Cartão consignado'], ['rcc', 'Cartão benefício']]) {
  for (const [suf, rotulo] of [['total', 'total'], ['utilizada', 'utilizada'], ['livre', 'livre'], ['pct', '% de uso'], ['data', 'data da consulta']]) {
    DETALHES[`${pref}_${suf}`] = `${nome}: ${rotulo}`;
  }
}

/** Valor comparável: vazio, data e decimais viram texto. */
function normalizar(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

const lista = (v) => (Array.isArray(v) ? v : []);

async function nomesDe(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const usuarios = await prisma.usuario.findMany({ where: { id: { in: unicos } }, select: { id: true, nome: true } });
  return new Map(usuarios.map((u) => [u.id, u.nome]));
}

/** Lista de { campo, de, para } entre o registro atual e as mudanças pedidas. */
async function calcularAlteracoes(atual, mudancas) {
  const alteracoes = [];

  for (const [chave, rotulo] of Object.entries(CAMPOS)) {
    if (!(chave in mudancas)) continue;
    const de = normalizar(atual[chave]);
    const para = normalizar(mudancas[chave]);
    if (de !== para) alteracoes.push({ campo: rotulo, de, para });
  }

  if ('responsavelId' in mudancas && normalizar(atual.responsavelId) !== normalizar(mudancas.responsavelId)) {
    const nomes = await nomesDe([atual.responsavelId, mudancas.responsavelId]);
    alteracoes.push({
      campo: 'Responsável',
      de: nomes.get(atual.responsavelId) ?? '',
      para: nomes.get(mudancas.responsavelId) ?? '',
    });
  }

  if (mudancas.detalhes !== undefined) {
    const antigos = atual.detalhes && typeof atual.detalhes === 'object' ? atual.detalhes : {};
    const novos = mudancas.detalhes ?? {};
    for (const chave of new Set([...Object.keys(antigos), ...Object.keys(novos)])) {
      const de = normalizar(antigos[chave]);
      const para = normalizar(novos[chave]);
      if (de !== para) alteracoes.push({ campo: DETALHES[chave] ?? chave, de, para });
    }
  }
  return alteracoes;
}

function validarRegras(final) {
  const estagio = final.estagio ?? 'novo';
  const receita = final.receitaEsperada === null || final.receitaEsperada === undefined ? 0 : Number(final.receitaEsperada);
  if (ESTAGIOS_COM_RECEITA.has(estagio) && !(receita > 0)) {
    throw erroHttp(400, `Informe a receita esperada para o estágio "${ESTAGIOS_ROTULO[estagio]}".`);
  }
  if (estagio === 'perdemos' && !normalizar(final.motivoPerda)) {
    throw erroHttp(400, 'Informe o motivo da perda.');
  }
}

/** O responsável precisa ser da equipe (o próprio dono ou um subordinado ativo). */
async function validarResponsavel(req, responsavelId) {
  if (!responsavelId) return;
  const alvo = await prisma.usuario.findFirst({
    where: { id: responsavelId, ativo: true, OR: [{ id: req.donoId }, { superiorId: req.donoId }] },
    select: { id: true },
  });
  if (!alvo) throw erroHttp(400, 'O responsável escolhido não pertence à sua equipe.');
}

// Quanto tempo o cliente fica com quem o pegou; depois disso volta a ficar disponível
export const DIAS_RESERVA = 5;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Quem "pegou" cada CPF: o responsável da oportunidade mais recente que ainda vale.
 * Vale por DIAS_RESERVA dias, contados da última mudança de estágio; cliente já ganho continua com quem fechou.
 * Vale para todas as equipes: o mesmo cliente não pode estar com dois usuários.
 * Retorna Map(cpfSóDígitos -> { donoDoCliente, equipe, estagio, expiraEm }). Sem responsável, o cliente é do supervisor.
 */
export async function reservasPorCpf(cpfs) {
  const alvo = new Set(cpfs.map(soDigitos).filter(Boolean));
  const mapa = new Map();
  if (!alvo.size) return mapa;
  const agora = Date.now();
  const ops = await prisma.oportunidade.findMany({
    where: { cpf: { not: null } },
    select: { donoId: true, cpf: true, responsavelId: true, estagio: true, estagioAtualizadoEm: true, atualizadoEm: true, criadoEm: true },
  });
  for (const o of ops) {
    const cpf = soDigitos(o.cpf);
    if (!alvo.has(cpf)) continue;
    const desde = (o.estagioAtualizadoEm ?? o.criadoEm).getTime();
    const expira = o.estagio === 'ganhamos' ? null : desde + DIAS_RESERVA * DIA_MS;
    if (expira !== null && expira <= agora) continue; // passou de 5 dias: cliente liberado
    const atual = mapa.get(cpf);
    if (!atual || desde > atual.desde) {
      mapa.set(cpf, { donoDoCliente: o.responsavelId ?? o.donoId, equipe: o.donoId, estagio: o.estagio, expiraEm: expira ? new Date(expira).toISOString() : null, desde });
    }
  }
  return mapa;
}

/** Só o master e o supervisor da equipe de quem pegou o cliente enxergam o nome. */
export const veNomeDeQuemPegou = (req, reserva) =>
  req.usuario.perfil === 'MASTER' || (req.usuario.perfil === 'SUPERVISOR' && reserva.equipe === req.donoId);

async function exigirClienteDisponivel(req, cpf) {
  const reserva = (await reservasPorCpf([cpf])).get(soDigitos(cpf));
  if (!reserva || reserva.donoDoCliente === req.usuario.id) return;
  if (veNomeDeQuemPegou(req, reserva)) {
    const quem = await prisma.usuario.findUnique({ where: { id: reserva.donoDoCliente }, select: { nome: true } });
    throw erroHttp(409, `Cliente indisponível: já está com ${quem?.nome ?? 'outro usuário'}.`);
  }
  throw erroHttp(409, 'Cliente indisponível.');
}

export async function prepararCriacao(req, dados) {
  const { notaInterna, ...resto } = dados;
  if (resto.cpf) await exigirClienteDisponivel(req, resto.cpf);

  if (req.usuario.perfil === 'PROMOTOR') resto.responsavelId = req.usuario.id;
  else await validarResponsavel(req, resto.responsavelId);
  validarRegras(resto);

  const agora = new Date().toISOString();
  const atividades = [{ data: agora, usuario: req.usuario.nome, estagio: ESTAGIOS_ROTULO[resto.estagio ?? 'novo'], descricao: 'Cliente cadastrado' }];
  if (notaInterna) atividades.push({ data: agora, usuario: req.usuario.nome, notaInterna });

  return { ...resto, atividades, estagioAtualizadoEm: new Date() };
}

export async function prepararAtualizacao(req, dados, atual) {
  const { notaInterna, ...resto } = dados;

  // Promotor não repassa o cliente; quem gerencia, sim (e só para alguém da equipe)
  if (req.usuario.perfil === 'PROMOTOR') delete resto.responsavelId;
  else if (resto.responsavelId) await validarResponsavel(req, resto.responsavelId);

  validarRegras({ ...atual, ...resto });

  const estagioMudou = resto.estagio && resto.estagio !== atual.estagio;
  // O estágio aparece destacado no histórico; não repete na lista de alterações
  const alteracoes = await calcularAlteracoes(atual, resto);

  const atividades = lista(atual.atividades);
  if (estagioMudou || alteracoes.length || notaInterna) {
    const entrada = { data: new Date().toISOString(), usuario: req.usuario.nome };
    if (estagioMudou) {
      entrada.estagio = ESTAGIOS_ROTULO[resto.estagio] ?? resto.estagio;
      if (resto.estagio === 'perdemos') entrada.motivoPerda = normalizar({ ...atual, ...resto }.motivoPerda);
    }
    if (alteracoes.length) entrada.alteracoes = alteracoes;
    if (notaInterna) entrada.notaInterna = notaInterna;
    atividades.push(entrada);
  }

  return {
    ...resto,
    atividades: atividades.slice(-MAX_ATIVIDADES),
    ...(estagioMudou && { estagioAtualizadoEm: new Date() }),
  };
}

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/** Todo cliente com oportunidade passa a constar na carteira (uma vez por CPF, dentro da equipe). */
export async function garantirNaCarteira(donoId, op) {
  const cpf = soDigitos(op.cpf);
  if (!cpf) return false;
  const existentes = await prisma.clienteCarteira.findMany({ where: { donoId }, select: { cpf: true } });
  if (existentes.some((c) => soDigitos(c.cpf) === cpf)) return false;
  await prisma.clienteCarteira.create({
    data: { donoId, cpf, nome: op.nome ?? null, convenio: op.empresa ?? null, telefone: op.telefone ?? null },
  });
  return true;
}
