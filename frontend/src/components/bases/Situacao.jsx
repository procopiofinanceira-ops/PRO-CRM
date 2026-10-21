import { STATUS_LEAD } from '../../lib/leads.js';

export default function Situacao({ status }) {
  const s = STATUS_LEAD.find((x) => x.valor === status) ?? { rotulo: status, cor: 'bg-surface2' };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.cor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.barra ?? 'bg-muted'}`} />
      {s.rotulo}
    </span>
  );
}
