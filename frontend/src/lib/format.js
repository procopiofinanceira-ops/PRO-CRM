export const moeda = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

export const dataBR = (v) => (v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

export const dataHoraBR = (v) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** ISO -> valor para <input type="date"> */
export const paraInputData = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');

/** ISO -> valor para <input type="datetime-local"> (fuso local) */
export const paraInputDataHora = (v) => {
  if (!v) return '';
  const d = new Date(v);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
