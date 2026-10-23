import { z } from 'zod';
import { criarCrud, txt, num } from '../lib/crud.js';
import { prisma } from '../lib/prisma.js';

const somenteDigitos = (v) => String(v ?? '').replace(/\D/g, '');

const inteiro = z.coerce.number().int().min(0).optional();

// ---------------- Convênios ----------------
export const convenios = criarCrud({
  model: 'convenio',
  busca: ['nome'],
  ordem: { nome: 'asc' },
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    descricao: txt,
    ativo: z.boolean().optional(),
  }),
});

// "Meus convênios": cadastro completo (CNPJ, código e detalhes)
export const conveniosCompletos = criarCrud({
  model: 'convenioCompleto',
  busca: ['nome', 'cnpj', 'codigo'],
  ordem: { nome: 'asc' },
  schema: z.object({
    nome: z.string().trim().min(2, 'Informe o nome.'),
    cnpj: txt,
    codigo: txt,
    detalhes: z.record(z.any()).nullable().optional(),
  }),
});

// Convênios cadastrados e leads duplicados (?tipo=CADASTRADO | LEAD_DUPLICADO)
export const conveniosControle = criarCrud({
  model: 'convenioControle',
  busca: ['empregador', 'codigo'],
  filtros: ['tipo'],
  ordem: { empregador: 'asc' },
  schema: z.object({
    tipo: z.enum(['CADASTRADO', 'LEAD_DUPLICADO']).optional(),
    empregador: z.string().trim().min(2, 'Informe o empregador.'),
    codigo: txt,
    tipoMargem: txt,
    funcionarios: inteiro,
    naoReservados: inteiro,
    reservados: inteiro,
    perdidos: inteiro,
  }),
});

export const inconsistencias = criarCrud({
  model: 'inconsistencia',
  busca: ['parceiro', 'codigoConvenio'],
  filtros: [],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    parceiro: z.string().trim().min(2, 'Informe o parceiro.'),
    codigoConvenio: z.string().trim().min(1, 'Informe o código do convênio.'),
    resolvido: z.boolean().optional(),
    dataRegistro: z.coerce.date().nullable().optional(),
    observacao: txt,
  }),
});

// ---------------- Margem ----------------
export const margens = criarCrud({
  model: 'margemConsignado',
  busca: ['nome', 'telefone', 'origem'],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    origem: txt,
    nome: z.string().trim().min(2, 'Informe o nome.'),
    ddd: txt,
    telefone: txt,
    margemLivre: num,
    status: txt,
    observacao: txt,
    mensagemBanco: txt,
    tags: z.array(z.string()).optional(),
  }),
});

export const solicitacoesMargem = criarCrud({
  model: 'margemSolicitacao',
  busca: ['nome', 'cpf', 'telefone'],
  filtros: ['status'],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    nome: txt,
    cpf: txt,
    telefone: txt,
    margemLivre: num,
    status: z.enum(['pendente', 'em_analise', 'concluida', 'recusada']).optional(),
    observacao: txt,
  }),
});

// ---------------- Simulações e dívidas ----------------
export const simulacoes = criarCrud({
  model: 'simulacao',
  busca: ['nome', 'cpf', 'convenio', 'telefone'],
  filtros: ['status'],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    convenio: txt,
    codEmpresa: txt,
    cpf: txt,
    cpfCliente: txt,
    margemLivre: num,
    nome: txt,
    ddd: txt,
    telefone: txt,
    status: txt,
    observacao: txt,
    qtdContratosRefin: z.coerce.number().int().nullable().optional(),
    contratosRefin: txt,
  }),
});

export const dividas = criarCrud({
  model: 'divida',
  busca: ['empregador'],
  ordem: { criadoEm: 'desc' },
  schema: z.object({
    empregador: z.string().trim().min(2, 'Informe o empregador.'),
    dividaTotal: num,
    taxaSimulacao: num,
    saldoClean: num,
    cartaoCredito: num,
    creditoPessoal: num,
    creditoConsignado: num,
    atraso: num,
    limiteEmConta: num,
  }),
});

// ---------------- Carteira de clientes ----------------
export const carteira = criarCrud({
  model: 'clienteCarteira',
  busca: ['nome', 'cpf', 'cpfCliente', 'convenio', 'telefone'],
  filtrosTexto: ['nome', 'cpf', 'telefone'],
  ordem: { criadoEm: 'desc' },
  // Situação do cliente nas oportunidades (mesmo CPF): negociacao (amarelo) | ganhamos (verde) | perdemos (vermelho).
  // Negociação em aberto vale mais que um desfecho antigo; entre desfechos, vale o mais recente.
  async aoListar(req, itens) {
    const cpfs = new Set(itens.map((c) => somenteDigitos(c.cpf)).filter(Boolean));
    if (!cpfs.size) return itens;
    const ops = await prisma.oportunidade.findMany({
      where: { donoId: req.donoId, cpf: { not: null } },
      select: { cpf: true, estagio: true, atualizadoEm: true },
      orderBy: { atualizadoEm: 'desc' },
    });
    const situacao = new Map();
    for (const o of ops) {
      const cpf = somenteDigitos(o.cpf);
      if (!cpfs.has(cpf)) continue;
      const nova = o.estagio === 'ganhamos' || o.estagio === 'perdemos' ? o.estagio : 'negociacao';
      const atual = situacao.get(cpf);
      if (!atual || (nova === 'negociacao' && atual !== 'negociacao')) situacao.set(cpf, nova);
    }
    return itens.map((c) => ({ ...c, situacao: situacao.get(somenteDigitos(c.cpf)) ?? null }));
  },
  schema: z.object({
    cpf: z.string().trim().min(11, 'Informe o CPF.'),
    cpfCliente: txt,
    convenio: txt,
    codEmpresa: txt,
    nome: txt,
    telefone: txt,
  }),
});
