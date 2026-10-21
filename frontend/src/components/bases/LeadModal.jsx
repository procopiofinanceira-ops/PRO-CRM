import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { CAMPOS } from '../../lib/mapeamento.js';
import { dataHoraBR, moeda } from '../../lib/format.js';
import { STATUS_LEAD, formatarCpf } from '../../lib/leads.js';
import { useEquipe } from '../../lib/useEquipe.js';
import { useToast } from '../Toast.jsx';
import Modal from '../Modal.jsx';

const ROTULO_CAMPO = Object.fromEntries(CAMPOS.map((c) => [c.valor, c.rotulo]));
const NUMERICOS = new Set(CAMPOS.filter((c) => c.numero).map((c) => c.valor));

/** Detalhe de um lead: dados da planilha, situação, responsável e observação. */
export default function LeadModal({ lead, podeAtribuir, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { usuarios } = useEquipe(podeAtribuir);
  const [status, setStatus] = useState(lead.statusLead);
  const [obs, setObs] = useState(lead.observacao ?? '');
  const [responsavel, setResponsavel] = useState(lead.funcionarioId ?? '');
  const [erro, setErro] = useState('');

  const salvar = useMutation({
    mutationFn: () =>
      api(`/leads/${lead.id}`, {
        method: 'PUT',
        body: { statusLead: status, observacao: obs, ...(podeAtribuir && { funcionarioId: responsavel || null }) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/leads'] });
      qc.invalidateQueries({ queryKey: ['/bases'] });
      toast.sucesso('Lead atualizado.');
      onClose();
    },
    onError: (e) => setErro(e.message),
  });

  const dados = Object.entries(lead.dados ?? {});

  return (
    <Modal titulo={lead.nome || 'Lead sem nome'} onClose={onClose} largura="max-w-2xl">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {[
          ['CPF', formatarCpf(lead.cpf)],
          ['Telefone', lead.telefone ?? '—'],
          ['Convênio', lead.convenio ?? '—'],
          ['Matrícula', lead.matricula ?? '—'],
          ['Margem livre', lead.margem ? moeda(lead.margem) : '—'],
          ['Importado em', dataHoraBR(lead.criadoEm)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface2/40 px-3 py-2">
            <dt className="kicker">{k}</dt>
            <dd className="num mt-0.5 text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {dados.length > 0 && (
        <>
          <h3 className="kicker mb-2 mt-5">Dados da planilha</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface2/40 p-4 text-sm sm:grid-cols-3">
            {dados.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{ROTULO_CAMPO[k] ?? k}</dt>
                <dd className="num">{NUMERICOS.has(k) && typeof v === 'number' ? moeda(v) : String(v)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className={podeAtribuir ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
          <label className="label" htmlFor="status">Situação</label>
          <select id="status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_LEAD.map((s) => (
              <option key={s.valor} value={s.valor}>{s.rotulo}</option>
            ))}
          </select>
        </div>
        {podeAtribuir && (
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="resp">Responsável</label>
            <select id="resp" className="input" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Sem responsável</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="label" htmlFor="obs">Observação</label>
          <textarea id="obs" rows={3} className="input" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
      </div>

      {erro && <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{erro}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
          {salvar.isPending && <Loader2 size={16} className="animate-spin" />} Salvar
        </button>
      </div>
    </Modal>
  );
}
