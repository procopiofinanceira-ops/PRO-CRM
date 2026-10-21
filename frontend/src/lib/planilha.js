const EXTENSOES = ['xlsx', 'xls', 'csv'];
const LIMITE_MB = 25;

/** Lê a primeira aba de uma planilha. Retorna { cabecalhos, linhas }. */
export async function lerPlanilha(arquivo) {
  const ext = arquivo.name.split('.').pop().toLowerCase();
  if (!EXTENSOES.includes(ext)) throw new Error('Arquivo inválido. Use .xlsx, .xls ou .csv.');
  if (arquivo.size > LIMITE_MB * 1024 * 1024) throw new Error(`Arquivo maior que ${LIMITE_MB} MB.`);

  // Carrega a biblioteca só quando necessário
  const XLSX = await import('xlsx');
  const buffer = await arquivo.arrayBuffer();

  let workbook;
  try {
    if (ext === 'csv') {
      // CSV: decodifica UTF-8 (ou Windows-1252, comum em exportações brasileiras) e
      // mantém os valores como texto, para não converter "1.234,56" em número errado.
      let texto;
      try {
        texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        texto = new TextDecoder('windows-1252').decode(buffer);
      }
      workbook = XLSX.read(texto.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
    } else {
      workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
    }
  } catch {
    throw new Error('Não foi possível ler a planilha.');
  }

  const aba = workbook.Sheets[workbook.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, defval: '', blankrows: false });

  const iCabecalho = matriz.findIndex((l) => l.some((c) => String(c).trim() !== ''));
  if (iCabecalho === -1) throw new Error('A planilha está vazia.');

  const cabecalhos = matriz[iCabecalho].map((h, i) => String(h).trim() || `Coluna ${i + 1}`);
  const linhas = matriz
    .slice(iCabecalho + 1)
    .map((l) => l.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c)))
    .filter((l) => l.some((c, i) => i < cabecalhos.length && String(c).trim() !== ''));

  if (!linhas.length) throw new Error('A planilha não tem linhas de dados.');
  return { cabecalhos, linhas };
}
