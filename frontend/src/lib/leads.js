export const STATUS_LEAD = [
  { valor: 'novo', rotulo: 'Novo', cor: 'bg-slate-400/20 text-slate-600 dark:text-slate-300', barra: 'bg-slate-400' },
  { valor: 'contatado', rotulo: 'Contatado', cor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', barra: 'bg-sky-500' },
  { valor: 'interesse', rotulo: 'Interesse', cor: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', barra: 'bg-violet-500' },
  { valor: 'agendado', rotulo: 'Agendado', cor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', barra: 'bg-amber-500' },
  { valor: 'convertido', rotulo: 'Convertido', cor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', barra: 'bg-emerald-500' },
  { valor: 'sem_interesse', rotulo: 'Sem interesse', cor: 'bg-primary/15 text-primary', barra: 'bg-primary' },
];

export const formatarCpf = (v) =>
  v && v.length === 11 ? v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v ?? '—';
