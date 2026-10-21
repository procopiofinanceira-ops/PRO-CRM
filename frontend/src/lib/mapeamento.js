// Campos de destino para o mapeamento das colunas da planilha.
// `numero: true` converte valores em formato brasileiro ("1.234,56") para número.

export const CAMPOS = [
  { valor: '', rotulo: '— Não importar —', grupo: '' },
  // Cliente
  { valor: 'nome', rotulo: 'Nome', grupo: 'Cliente' },
  { valor: 'cpf', rotulo: 'CPF', grupo: 'Cliente' },
  { valor: 'celular1', rotulo: 'Celular', grupo: 'Cliente' },
  { valor: 'ddd', rotulo: 'DDD', grupo: 'Cliente' },
  { valor: 'outros_telefones', rotulo: 'Outros telefones', grupo: 'Cliente' },
  { valor: 'email', rotulo: 'E-mail', grupo: 'Cliente' },
  { valor: 'nascimento', rotulo: 'Nascimento', grupo: 'Cliente' },
  { valor: 'idade', rotulo: 'Idade', grupo: 'Cliente', numero: true },
  { valor: 'matricula', rotulo: 'Matrícula', grupo: 'Cliente' },
  { valor: 'tipo_servidor', rotulo: 'Tipo de servidor', grupo: 'Cliente' },
  { valor: 'cidade', rotulo: 'Cidade', grupo: 'Cliente' },
  { valor: 'produto', rotulo: 'Produto', grupo: 'Cliente' },
  { valor: 'observacao', rotulo: 'Observação', grupo: 'Cliente' },
  // Banco
  { valor: 'banco', rotulo: 'Banco', grupo: 'Pagamento' },
  { valor: 'agencia', rotulo: 'Agência', grupo: 'Pagamento' },
  { valor: 'conta', rotulo: 'Conta', grupo: 'Pagamento' },
  { valor: 'meio_pagamento', rotulo: 'Meio de pagamento', grupo: 'Pagamento' },
  { valor: 'data_beneficio', rotulo: 'Data do benefício', grupo: 'Pagamento' },
  // Margens
  { valor: 'emp_livre', rotulo: 'Empréstimo: margem livre', grupo: 'Margens', numero: true },
  { valor: 'emp_total', rotulo: 'Empréstimo: margem total', grupo: 'Margens', numero: true },
  { valor: 'emp_utilizada', rotulo: 'Empréstimo: margem utilizada', grupo: 'Margens', numero: true },
  { valor: 'rmc_livre', rotulo: 'Cartão consignado: livre', grupo: 'Margens', numero: true },
  { valor: 'rmc_total', rotulo: 'Cartão consignado: total', grupo: 'Margens', numero: true },
  { valor: 'rmc_utilizada', rotulo: 'Cartão consignado: utilizada', grupo: 'Margens', numero: true },
  { valor: 'rcc_livre', rotulo: 'Cartão benefício: livre', grupo: 'Margens', numero: true },
  { valor: 'rcc_total', rotulo: 'Cartão benefício: total', grupo: 'Margens', numero: true },
  { valor: 'rcc_utilizada', rotulo: 'Cartão benefício: utilizada', grupo: 'Margens', numero: true },
  // Contrato
  { valor: 'numero_contrato', rotulo: 'Número do contrato', grupo: 'Contrato' },
  { valor: 'valor_parcela', rotulo: 'Valor da parcela', grupo: 'Contrato', numero: true },
  { valor: 'qtd_parcelas', rotulo: 'Qtd. de parcelas', grupo: 'Contrato', numero: true },
  { valor: 'parcelas_pagas', rotulo: 'Parcelas pagas', grupo: 'Contrato', numero: true },
  { valor: 'saldo_devedor', rotulo: 'Saldo devedor', grupo: 'Contrato', numero: true },
  { valor: 'taxa_mes', rotulo: 'Taxa ao mês', grupo: 'Contrato', numero: true },
];

const NUMERICOS = new Set(CAMPOS.filter((c) => c.numero).map((c) => c.valor));
const GRUPOS = [...new Set(CAMPOS.map((c) => c.grupo).filter(Boolean))];
export const CAMPOS_POR_GRUPO = GRUPOS.map((g) => ({ grupo: g, campos: CAMPOS.filter((c) => c.grupo === g) }));

const normalizar = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Sugere o campo de destino a partir do nome da coluna. */
export function detectarCampo(coluna) {
  const c = normalizar(coluna);
  const tem = (...ts) => ts.some((t) => c.includes(t));

  // Colunas compostas ("Data de nascimento - CPF") misturam informações: não mapear
  if (c.includes(' - ')) return '';

  if (tem('cpf')) return 'cpf';
  if (tem('matric')) return 'matricula';
  if (tem('email', 'e-mail', 'e_mail')) return 'email';
  if (tem('nasc')) return 'nascimento';
  if (tem('outro') && tem('tel', 'cel', 'fone')) return 'outros_telefones';
  if (c === 'ddd') return 'ddd';
  if (tem('celular', 'telefone', 'fone', 'whats', 'wpp', 'zap') || /^(cel|tel)$/.test(c)) return 'celular1';
  if (tem('tipo') && tem('serv')) return 'tipo_servidor';
  if (tem('cidade', 'municipio')) return 'cidade';

  if (tem('saldo') && tem('dev')) return 'saldo_devedor';
  if (tem('taxa', 'juros') && !tem('margem')) return 'taxa_mes';
  if (tem('parc') && tem('pag')) return 'parcelas_pagas';
  if (tem('parc') && tem('qtd', 'qtde', 'quant', 'total', 'prazo')) return 'qtd_parcelas';
  if (tem('num') && tem('contrat')) return 'numero_contrato';
  if (c === 'parcela' || (tem('parc') && tem('valor', 'vlr'))) return 'valor_parcela';

  if (c === 'dib' || (tem('benefic') && tem('data'))) return 'data_beneficio';
  if (tem('pagamento') && !tem('margem')) return 'meio_pagamento';
  if (tem('agencia')) return 'agencia';
  if (tem('conta')) return 'conta';
  if (tem('banco')) return 'banco';

  if (tem('margem', 'emprestimo')) {
    const prefixo = tem('benef', 'rcc') ? 'rcc' : tem('cartao', 'rmc') ? 'rmc' : 'emp';
    if (tem('livre', 'disp')) return `${prefixo}_livre`;
    if (tem('total')) return `${prefixo}_total`;
    if (tem('utiliz', 'reserv')) return `${prefixo}_utilizada`;
    return prefixo === 'emp' && c.includes('margem') ? 'emp_livre' : '';
  }

  if (c === 'produto' || c === 'produtos') return 'produto';
  if (tem('nome', 'name') && !tem('conven', 'banco', 'fantasia', 'empresa')) return 'nome';
  return '';
}

/** "1.234,56" | "R$ 1234.5" | 12 -> número (ou null). */
export function paraNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').replace(/[R$\s%]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Converte uma linha da planilha no registro de importação, segundo o mapeamento. */
export function montarRegistro(linha, mapeamento) {
  const registro = {};
  for (const [indice, campo] of Object.entries(mapeamento)) {
    if (!campo) continue;
    const bruto = linha[indice];
    if (bruto === undefined || bruto === null || String(bruto).trim() === '') continue;
    registro[campo] = NUMERICOS.has(campo) ? paraNumero(bruto) : String(bruto).trim();
  }
  return registro;
}
