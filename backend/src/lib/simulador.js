// Simuladores de crédito imobiliário.
//
// Os parâmetros dos bancos (taxas, LTV máximo, tarifas) ficam em BANCOS_*.
// Confirme os valores com a mesa de crédito antes de usar com clientes: taxas
// mudam com frequência e os números abaixo são os padrões herdados do sistema anterior.

export const BANCOS_FINANCIAMENTO = {
  bradesco: { nome: 'Bradesco', taxas: [11.8, 11.99, 12.3, 12.5], cesh: 2.22, vistoria: 2114.03, vistoriaSomada: false, maxLTV: 0.8 },
  itau: { nome: 'Itaú', taxas: [11.7, 11.9, 11.95, 12.0, 12.29], cesh: 2.23, vistoria: 1950.0, vistoriaSomada: false, maxLTV: 0.8 },
  santander: {
    nome: 'Santander',
    taxas: [11.69, 11.79, 11.99, 12.0, 12.29, 12.49, 12.79, 12.99, 13.09, 13.19, 13.29, 13.39, 13.49, 13.79],
    cesh: 2.29,
    vistoria: 1950.0,
    vistoriaSomada: false,
    maxLTV: 0.8,
  },
  inter: { nome: 'Inter', taxaFixa: 10.0, cesh: 3.6, vistoria: 5000.0, vistoriaSomada: true, maxLTV: 0.75 },
};

// Home equity: taxas em % ao mês
export const BANCOS_HOME_EQUITY = {
  creditas: { nome: 'Creditas', taxas: [1.09, 1.19, 1.29, 1.39, 1.49, 1.59, 1.69, 1.75], cesh: 2.22, tarifaAvaliacao: 3000.0, maxLTV: 0.6 },
  santander: { nome: 'Santander', taxas: [1.35, 1.5, 1.65, 1.8, 1.95, 2.0], cesh: 2.29, tarifaAvaliacao: 2950.0, maxLTV: 0.6 },
  inter: { nome: 'Inter', taxas: [1.19, 1.29, 1.39, 1.49, 1.59, 1.69, 1.79, 1.85], cesh: 3.6, tarifaAvaliacao: 5000.0, maxLTV: 0.6 },
};

const DESPESAS_FINANCIAMENTO = 0.05; // 5% do valor do imóvel
const IOF_HOME_EQUITY = 0.0038;
const COMPROMETIMENTO_RENDA = 0.3; // parcela até 30% da renda

const arredonda = (n) => Math.round(n * 100) / 100;

/** Sistema SAC: amortização constante. `r` é a taxa mensal (decimal). */
function calcSAC(principal, r, meses) {
  const amort = principal / meses;
  let total = 0;
  let saldo = principal;
  for (let i = 0; i < meses; i += 1) {
    total += amort + saldo * r;
    saldo -= amort;
  }
  return { primeiraParcela: amort + principal * r, ultimaParcela: amort + amort * r, totalParcelas: total };
}

/** Sistema PRICE: parcelas fixas. */
function calcPRICE(principal, r, meses) {
  const parcela = (principal * r * (1 + r) ** meses) / ((1 + r) ** meses - 1);
  return { primeiraParcela: parcela, ultimaParcela: parcela, totalParcelas: parcela * meses };
}

const calcular = (sistema, principal, r, meses) =>
  sistema === 'SAC' ? calcSAC(principal, r, meses) : calcPRICE(principal, r, meses);

function arredondaResultado(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'number' ? arredonda(v) : v]));
}

/** Financiamento imobiliário (taxas em % ao ano). Retorna um resultado por banco. */
export function simularFinanciamento({ valorImovel, valorFinanciado, prazo, sistema, incluirDespesas, taxas = {} }) {
  const resultado = {};
  for (const [chave, cfg] of Object.entries(BANCOS_FINANCIAMENTO)) {
    const taxaEfetiva = cfg.taxaFixa ?? taxas[chave] ?? cfg.taxas[0];
    const despesas = incluirDespesas ? valorImovel * DESPESAS_FINANCIAMENTO : 0;
    const maxFinanciamento = Math.floor(valorImovel * cfg.maxLTV);
    const liberado = Math.min(valorFinanciado, maxFinanciamento);
    const totalFinanciado = liberado + despesas + (cfg.vistoriaSomada ? cfg.vistoria : 0);

    const rMensal = (1 + taxaEfetiva / 100) ** (1 / 12) - 1;
    const calc = calcular(sistema, totalFinanciado, rMensal, prazo);

    resultado[chave] = arredondaResultado({
      nome: cfg.nome,
      financiamentoLiberado: liberado,
      despesas,
      vistoria: cfg.vistoria,
      vistoriaSomada: cfg.vistoriaSomada,
      totalFinanciado,
      entrada: valorImovel - liberado,
      prazo,
      rendaAproximada: calc.primeiraParcela / COMPROMETIMENTO_RENDA,
      primeiraParcela: calc.primeiraParcela,
      ultimaParcela: calc.ultimaParcela,
      totalParcelas: calc.totalParcelas,
      taxaEfetiva,
      taxaNominal: rMensal * 12 * 100,
      cesh: cfg.cesh,
      cet: taxaEfetiva + cfg.cesh,
      sistema,
      limitado: valorFinanciado > maxFinanciamento,
    });
  }
  return resultado;
}

/** Home equity (taxas em % ao mês). */
export function simularHomeEquity({ valorImovel, valorEmprestimo, prazo, sistema, incluirAvaliacao, incluirIOF, taxas = {} }) {
  const resultado = {};
  for (const [chave, cfg] of Object.entries(BANCOS_HOME_EQUITY)) {
    const taxaMensal = taxas[chave] ?? cfg.taxas[0];
    const maxEmprestimo = Math.floor(valorImovel * cfg.maxLTV);
    const bruto = Math.min(valorEmprestimo, maxEmprestimo);
    const avaliacao = incluirAvaliacao ? cfg.tarifaAvaliacao : 0;
    const iof = incluirIOF ? bruto * IOF_HOME_EQUITY : 0;
    const totalFinanciado = bruto + avaliacao + iof;

    const calc = calcular(sistema, totalFinanciado, taxaMensal / 100, prazo);
    const taxaEfetivaAnual = ((1 + taxaMensal / 100) ** 12 - 1) * 100;

    resultado[chave] = arredondaResultado({
      nome: cfg.nome,
      emprestimoBruto: bruto,
      avaliacao,
      iof,
      totalFinanciado,
      prazo,
      rendaAproximada: calc.primeiraParcela / COMPROMETIMENTO_RENDA,
      primeiraParcela: calc.primeiraParcela,
      ultimaParcela: calc.ultimaParcela,
      totalParcelas: calc.totalParcelas,
      taxaMensal,
      taxaEfetivaAnual,
      taxaNominalAnual: taxaMensal * 12,
      cesh: cfg.cesh,
      cet: taxaEfetivaAnual + cfg.cesh,
      sistema,
      limitado: valorEmprestimo > maxEmprestimo,
    });
  }
  return resultado;
}

/** Parâmetros que o frontend precisa para montar os formulários. */
export function configSimuladores() {
  const resumo = (bancos) =>
    Object.entries(bancos).map(([chave, c]) => ({
      chave,
      nome: c.nome,
      taxas: c.taxas ?? null,
      taxaFixa: c.taxaFixa ?? null,
      maxLTV: c.maxLTV,
    }));
  return { financiamento: resumo(BANCOS_FINANCIAMENTO), homeEquity: resumo(BANCOS_HOME_EQUITY) };
}
