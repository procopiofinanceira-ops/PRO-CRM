/** Converte a margem digitada na planilha ("1.234,56", "1234.56", "R$ 525") em número, ou null. */
export function paraNumero(valor) {
  if (valor === null || valor === undefined) return null;
  let t = String(valor).replace(/[^0-9,.-]/g, '');
  if (!t) return null;
  if (t.includes(',')) {
    // formato brasileiro: ponto separa milhar, vírgula separa decimais
    t = t.split('.').join('').replace(',', '.');
  } else {
    // só pontos: grupos de 3 dígitos são milhar ("1.234.567"); senão o último ponto é decimal ("1234.56")
    const partes = t.split('.');
    if (partes.length > 1 && partes.slice(1).every((p) => p.length === 3)) t = partes.join('');
    else if (partes.length > 2) t = `${partes.slice(0, -1).join('')}.${partes[partes.length - 1]}`;
  }
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) < 1e13 ? Math.round(n * 100) / 100 : null;
}
