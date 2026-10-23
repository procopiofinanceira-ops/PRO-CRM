import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  Clock,
  FileText,
  History,
  Loader2,
  MessageCircle,
  Star,
  Trash2,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { dataHoraBR } from '../../lib/format.js';
import { paraNumero } from '../../lib/mapeamento.js';
import { ESTAGIOS, ESTAGIOS_COM_RECEITA, MOTIVOS_PERDA, ROTULO_ESTAGIO, numeroWhatsApp } from '../../lib/oportunidade.js';
import { useEquipe } from '../../lib/useEquipe.js';
import Modal from '../Modal.jsx';

// Campos que ficam no JSON `detalhes` (o servidor também registra as mudanças deles no histórico)
const MARGENS = [
  { pref: 'emp', titulo: 'Empréstimo', cor: 'emerald' },
  { pref: 'rmc', titulo: 'Cartão consignado', cor: 'amber' },
  { pref: 'rcc', titulo: 'Cartão benefício', cor: 'sky' },
];
const SUFIXOS_MARGEM = ['total', 'utilizada', 'livre', 'pct', 'data'];
const DETALHES_TEXTO = [
  'outros_telefones', 'nascimento', 'matricula', 'tipo_servidor', 'codigo_convenio', 'campanha', 'data_beneficio',
  'meio_pagamento', 'banco', 'ag_banco', 'conta_corrente', 'numero_contrato',
];
const DETALHES_NUMERO = [
  'idade', 'valor_parcela', 'qtd_parcelas_total', 'qtd_parcelas_pagas', 'qtd_parcelas_futuras', 'qtd_parcelas_vencidas',
  'taxa_mes', 'saldo_devedor', ...MARGENS.flatMap((m) => ['total', 'utilizada', 'livre', 'pct'].map((s) => `${m.pref}_${s}`)),
];
const DETALHES_PADRAO = new Set([
  ...DETALHES_TEXTO,
  ...DETALHES_NUMERO,
  ...MARGENS.flatMap((m) => [`${m.pref}_data`]),
  'celular1',
]);

const texto = (v) => (v === null || v === undefined ? '' : String(v));
const dia = (v) => (v ? String(v).slice(0, 10) : '');

function montarInicial(op, estagioPadrao) {
  const det = op?.detalhes && typeof op.detalhes === 'object' ? op.detalhes : {};
  const form = {
    nome: texto(op?.nome),
    cpf: texto(op?.cpf),
    empresa: texto(op?.empresa),
    telefone: texto(op?.telefone),
    email: texto(op?.email),
    produto: texto(op?.produto),
    cidade: texto(op?.cidade),
    estagio: estagioPadrao ?? op?.estagio ?? 'novo',
    prioridade: op?.prioridade ?? 0,
    valor: texto(op?.valor),
    receitaEsperada: texto(op?.receitaEsperada),
    dataRetorno: dia(op?.dataRetorno),
    horaRetorno: texto(op?.horaRetorno),
    descricao: texto(op?.descricao),
    motivoPerda: texto(op?.motivoPerda),
    responsavelId: texto(op?.responsavelId),
    notaInterna: '',
  };
  for (const k of [...DETALHES_TEXTO, ...DETALHES_NUMERO, ...MARGENS.map((m) => `${m.pref}_data`)]) form[k] = texto(det[k]);
  // O que veio da planilha e não tem campo próprio fica editável em "Dados adicionais"
  const extras = Object.fromEntries(Object.entries(det).filter(([k]) => !DETALHES_PADRAO.has(k)).map(([k, v]) => [k, texto(v)]));
  return { ...form, _extras: extras };
}

function Campo({ rotulo, valor, onChange, tipo = 'text', placeholder, obrigatorio, erro, modo }) {
  return (
    <div>
      <label className={`label ${erro ? '!text-primary' : ''}`}>
        {rotulo}
        {obrigatorio && <span className="text-primary"> *</span>}
      </label>
      <input
        className={`input !py-1.5 ${erro ? '!border-primary' : ''}`}
        type={tipo}
        inputMode={modo}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Secao({ titulo, children, dica }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
        <h3 className="kicker">{titulo}</h3>
        {dica && <span className="text-[11px] text-muted">{dica}</span>}
      </div>
      {children}
    </section>
  );
}

const COR_MARGEM = {
  emerald: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
  amber: 'border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400',
  sky: 'border-sky-500/40 bg-sky-500/5 text-sky-600 dark:text-sky-400',
};

/** Linha do tempo do histórico (gerado pelo servidor). */
function Historico({ atividades }) {
  const itens = [...(Array.isArray(atividades) ? atividades : [])].reverse();
  if (!itens.length) {
    return (
      <div className="grid place-items-center gap-2 py-16 text-center text-muted">
        <History size={36} className="opacity-40" />
        <p className="text-sm font-medium">Nenhuma atividade registrada</p>
        <p className="text-xs">As alterações feitas neste cliente aparecem aqui.</p>
      </div>
    );
  }
  return (
    <ol className="space-y-0">
      {itens.map((a, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" />
            {i < itens.length - 1 && <span className="my-1 min-h-[16px] w-px flex-1 bg-line" />}
          </div>
          <div className="min-w-0 flex-1 pb-5">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              {a.data && (
                <span className="num flex items-center gap-1 text-muted">
                  <Clock size={11} /> {dataHoraBR(a.data)}
                </span>
              )}
              {a.usuario && <span className="rounded bg-accent/10 px-1.5 py-0.5 font-semibold text-accent">{a.usuario}</span>}
              {a.estagio && <span className="rounded-full bg-surface2 px-2 py-0.5 font-medium">→ {a.estagio}</span>}
            </div>
            {a.notaInterna && (
              <div className="mb-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <p className="kicker !text-amber-600 dark:!text-amber-400">Anotação interna</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{a.notaInterna}</p>
              </div>
            )}
            {a.descricao && <p className="mb-1 text-sm text-muted">{a.descricao}</p>}
            {a.motivoPerda && (
              <p className="mb-1 text-sm text-primary">
                <span className="font-semibold">Motivo da perda:</span> {a.motivoPerda}
              </p>
            )}
            {a.alteracoes?.length > 0 && (
              <ul className="mt-1 space-y-1">
                {a.alteracoes.map((alt, j) => (
                  <li key={j} className="flex flex-wrap items-baseline gap-1.5 text-xs">
                    <span className="font-semibold text-muted">{alt.campo}:</span>
                    {alt.de && <span className="num text-primary/80 line-through">{alt.de}</span>}
                    {alt.de && alt.para && <span className="text-muted">→</span>}
                    {alt.para ? <span className="num text-emerald-600 dark:text-emerald-400">{alt.para}</span> : <em className="text-muted">removido</em>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Modal completo do cliente (oportunidade): dados, margens, negociação, contrato e histórico.
 * onSalvar(payload) deve devolver uma promessa; se falhar, a mensagem aparece no modal.
 */
export default function OportunidadeModal({ oportunidade, estagioPadrao, aviso, podeAtribuir, onSalvar, onExcluir, onClose }) {
  const novo = !oportunidade?.id;
  const [aba, setAba] = useState('dados');
  const [f, setF] = useState(() => montarInicial(oportunidade, estagioPadrao));
  const [extrasAbertos, setExtrasAbertos] = useState(true);
  const [motivoPendente, setMotivoPendente] = useState('');
  const [observacaoMotivo, setObservacaoMotivo] = useState('');
  const [editandoMotivo, setEditandoMotivo] = useState(!oportunidade?.motivoPerda);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(aviso ?? '');

  const { promotores } = useEquipe(podeAtribuir);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const setExtra = (k) => (v) => setF((x) => ({ ...x, _extras: { ...x._extras, [k]: v } }));

  // Convênios em que este CPF aparece (aviso antes de abordar o cliente)
  const digitosCpf = f.cpf.replace(/\D/g, '');
  const { data: conveniosCpf = [] } = useQuery({
    queryKey: ['/leads/cpf', digitosCpf],
    queryFn: () => api(`/leads/cpf/${digitosCpf}`),
    select: (r) => r.convenios,
    enabled: digitosCpf.length === 11,
    staleTime: 60_000,
  });

  const exigeReceita = ESTAGIOS_COM_RECEITA.has(f.estagio);
  const semReceita = exigeReceita && !(paraNumero(f.receitaEsperada) > 0);
  const semMotivo = f.estagio === 'perdemos' && !f.motivoPerda.trim();
  const retornoVencido = f.dataRetorno && f.dataRetorno <= new Date().toLocaleDateString('en-CA') && !['ganhamos', 'perdemos'].includes(f.estagio);
  const wa = numeroWhatsApp(f.telefone);
  const extras = Object.entries(f._extras);

  const notasAnteriores = useMemo(
    () => (Array.isArray(oportunidade?.atividades) ? oportunidade.atividades.filter((a) => a.notaInterna) : []),
    [oportunidade],
  );

  const salvar = async () => {
    setErro('');
    setSalvando(true);
    try {
      const detalhes = {};
      for (const k of DETALHES_TEXTO) if (f[k].trim()) detalhes[k] = f[k].trim();
      for (const m of MARGENS) if (f[`${m.pref}_data`]) detalhes[`${m.pref}_data`] = f[`${m.pref}_data`];
      for (const k of DETALHES_NUMERO) {
        const v = f[k].trim();
        if (!v) continue;
        const n = paraNumero(v);
        detalhes[k] = n === null ? v : n;
      }
      for (const [k, v] of extras) if (String(v).trim()) detalhes[k] = String(v).trim();

      const numero = (v) => (v.trim() === '' ? null : paraNumero(v));
      await onSalvar({
        nome: f.nome.trim(),
        cpf: f.cpf.trim() || null,
        empresa: f.empresa.trim() || null,
        telefone: f.telefone.trim() || null,
        email: f.email.trim() || null,
        produto: f.produto.trim() || null,
        cidade: f.cidade.trim() || null,
        estagio: f.estagio,
        prioridade: f.prioridade,
        valor: numero(f.valor),
        receitaEsperada: numero(f.receitaEsperada),
        dataRetorno: f.dataRetorno || null,
        horaRetorno: f.horaRetorno || null,
        descricao: f.descricao.trim() || null,
        motivoPerda: f.estagio === 'perdemos' ? f.motivoPerda.trim() || null : null,
        ...(podeAtribuir && { responsavelId: f.responsavelId || null }),
        ...(f.notaInterna.trim() && { notaInterna: f.notaInterna.trim() }),
        detalhes: Object.keys(detalhes).length ? detalhes : null,
      });
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={novo ? 'Novo cliente' : `Cliente: ${oportunidade.nome}`} onClose={onClose} largura="max-w-4xl">
      {!novo && (
        <div className="-mt-1 mb-5 flex gap-1 border-b border-line">
          {[['dados', 'Dados', FileText], ['historico', 'Histórico', History]].map(([v, rotulo, Icone]) => (
            <button
              key={v}
              type="button"
              onClick={() => setAba(v)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                aba === v ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              <Icone size={15} /> {rotulo}
              {v === 'historico' && <span className="num rounded-full bg-surface2 px-1.5 text-[10px]">{oportunidade.atividades?.length ?? 0}</span>}
            </button>
          ))}
        </div>
      )}

      {aba === 'historico' && !novo ? (
        <Historico atividades={oportunidade.atividades} />
      ) : (
        <div className="space-y-6">
          {erro && (
            <p className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-primary" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erro}
            </p>
          )}

          {digitosCpf.length === 11 && conveniosCpf.length > 0 && (
            <div
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-xs ${
                conveniosCpf.length > 1 ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-line bg-surface2/50'
              }`}
            >
              {conveniosCpf.length > 1 && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-semibold">{conveniosCpf.length > 1 ? `CPF em ${conveniosCpf.length} convênios` : 'Convênio na base'}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {conveniosCpf.map((c) => (
                    <span key={c} className="rounded border border-current/30 px-1.5 py-0.5 font-medium">{c}</span>
                  ))}
                </p>
                {conveniosCpf.length > 1 && <p className="mt-1 opacity-90">Confira antes de prosseguir com o atendimento.</p>}
              </div>
            </div>
          )}

          {/* Estágio */}
          <div className="flex flex-wrap gap-1.5 border-b border-line pb-4">
            {ESTAGIOS.map((e) => (
              <button
                key={e.valor}
                type="button"
                onClick={() => set('estagio')(e.valor)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  f.estagio === e.valor
                    ? `${e.cor} border-transparent text-white shadow-md`
                    : 'border-line text-muted hover:border-accent/40 hover:text-fg'
                }`}
              >
                {e.rotulo}
              </button>
            ))}
          </div>

          {/* Motivo da perda */}
          {f.estagio === 'perdemos' && (
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="kicker !text-primary">Motivo da perda *</p>
                {f.motivoPerda && !editandoMotivo && (
                  <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setEditandoMotivo(true)}>
                    Alterar
                  </button>
                )}
              </div>
              {f.motivoPerda && !editandoMotivo ? (
                <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium">{f.motivoPerda}</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {MOTIVOS_PERDA.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMotivoPendente(m); setObservacaoMotivo(''); }}
                        className={`rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition ${
                          motivoPendente === m ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface hover:border-primary/50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {motivoPendente && (
                    <div className="space-y-2 border-t border-primary/30 pt-3">
                      <label className="kicker" htmlFor="obs-motivo">Observação (opcional)</label>
                      <textarea id="obs-motivo" rows={2} className="input" value={observacaoMotivo} onChange={(e) => setObservacaoMotivo(e.target.value)} />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="btn-primary !py-1.5"
                          onClick={() => {
                            set('motivoPerda')(observacaoMotivo.trim() ? `${motivoPendente}: ${observacaoMotivo.trim()}` : motivoPendente);
                            setEditandoMotivo(false);
                            setMotivoPendente('');
                          }}
                        >
                          Confirmar motivo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Secao titulo="Dados do cliente">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Nome completo" obrigatorio valor={f.nome} onChange={set('nome')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="CPF" valor={f.cpf} onChange={set('cpf')} placeholder="000.000.000-00" modo="numeric" /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Convênio" valor={f.empresa} onChange={set('empresa')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Código do convênio" valor={f.codigo_convenio} onChange={set('codigo_convenio')} /></div>

              <div className="col-span-2 sm:col-span-1">
                <label className="label">Celular</label>
                <div className="flex gap-2">
                  <input className="input !py-1.5" value={f.telefone} onChange={(e) => set('telefone')(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" />
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white transition hover:brightness-110"
                      title={`Abrir WhatsApp: ${f.telefone}`}
                      aria-label="Abrir conversa no WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </a>
                  )}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Outros telefones" valor={f.outros_telefones} onChange={set('outros_telefones')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="E-mail" tipo="email" valor={f.email} onChange={set('email')} /></div>
              <div className="col-span-2 grid grid-cols-3 gap-3 sm:col-span-1">
                <div className="col-span-2"><Campo rotulo="Nascimento" tipo="date" valor={f.nascimento} onChange={set('nascimento')} /></div>
                <Campo rotulo="Idade" valor={f.idade} onChange={set('idade')} modo="numeric" />
              </div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Matrícula" valor={f.matricula} onChange={set('matricula')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Tipo de servidor" valor={f.tipo_servidor} onChange={set('tipo_servidor')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Produto" valor={f.produto} onChange={set('produto')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Cidade" valor={f.cidade} onChange={set('cidade')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Data do benefício" tipo="date" valor={f.data_beneficio} onChange={set('data_beneficio')} /></div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Meio de pagamento" valor={f.meio_pagamento} onChange={set('meio_pagamento')} /></div>
              <div className="col-span-2 grid grid-cols-3 gap-3">
                <Campo rotulo="Banco" valor={f.banco} onChange={set('banco')} />
                <Campo rotulo="Agência" valor={f.ag_banco} onChange={set('ag_banco')} />
                <Campo rotulo="Conta corrente" valor={f.conta_corrente} onChange={set('conta_corrente')} />
              </div>
            </div>
          </Secao>

          <Secao titulo="Margens">
            <div className="grid gap-3 md:grid-cols-3">
              {MARGENS.map((m) => (
                <div key={m.pref} className={`space-y-2 rounded-2xl border p-3 ${COR_MARGEM[m.cor]}`}>
                  <p className="text-center text-xs font-bold">{m.titulo}</p>
                  <div className="grid grid-cols-2 gap-2 text-fg">
                    {SUFIXOS_MARGEM.map((s) => {
                      const rotulos = { total: 'Total', utilizada: 'Utilizada', livre: 'Livre', pct: '% de uso', data: 'Data da consulta' };
                      return (
                        <div key={s} className={s === 'data' ? 'col-span-2' : ''}>
                          <Campo
                            rotulo={rotulos[s]}
                            tipo={s === 'data' ? 'date' : 'text'}
                            modo={s === 'data' ? undefined : 'decimal'}
                            placeholder={s === 'pct' ? '0' : s === 'data' ? undefined : '0,00'}
                            valor={f[`${m.pref}_${s}`]}
                            onChange={set(`${m.pref}_${s}`)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Secao>

          <Secao titulo="Negociação">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Campanha" valor={f.campanha} onChange={set('campanha')} /></div>
              {podeAtribuir && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="label" htmlFor="resp-op">Promotor responsável</label>
                  <select id="resp-op" className="input !py-1.5" value={f.responsavelId} onChange={(e) => set('responsavelId')(e.target.value)}>
                    <option value="">Sem promotor</option>
                    {promotores.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Prioridade</label>
                <div className="flex gap-1 pt-1" role="radiogroup" aria-label="Prioridade">
                  {[1, 2, 3].map((i) => (
                    <button key={i} type="button" onClick={() => set('prioridade')(f.prioridade === i ? 0 : i)} aria-label={`${i} estrela${i > 1 ? 's' : ''}`}>
                      <Star size={22} className={`transition ${i <= f.prioridade ? 'fill-amber-400 text-amber-400' : 'text-line'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1"><Campo rotulo="Valor (R$)" valor={f.valor} onChange={set('valor')} modo="decimal" placeholder="0,00" /></div>
              <div className="col-span-2 sm:col-span-1">
                <Campo
                  rotulo="Receita esperada (R$)"
                  obrigatorio={exigeReceita}
                  erro={semReceita}
                  valor={f.receitaEsperada}
                  onChange={set('receitaEsperada')}
                  modo="decimal"
                  placeholder="0,00"
                />
                {semReceita && <p className="mt-1 text-[11px] text-primary">Obrigatória no estágio “{ROTULO_ESTAGIO[f.estagio]}”.</p>}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Agendar retorno</label>
                <div className="flex gap-2">
                  <input type="date" className="input num !py-1.5" value={f.dataRetorno} onChange={(e) => set('dataRetorno')(e.target.value)} aria-label="Data do retorno" />
                  <input type="time" className="input num !w-28 !py-1.5" value={f.horaRetorno} onChange={(e) => set('horaRetorno')(e.target.value)} aria-label="Hora do retorno" />
                </div>
              </div>

              {retornoVencido && (
                <div className="col-span-2 flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
                  <Bell size={18} className="mt-0.5 shrink-0 animate-pulse" />
                  <p className="text-sm">
                    <strong>Retorno agendado!</strong> Este cliente tem retorno para{' '}
                    <strong className="num">{new Date(`${f.dataRetorno}T12:00:00`).toLocaleDateString('pt-BR')}</strong>
                    {f.horaRetorno && <strong className="num"> às {f.horaRetorno}</strong>}.
                  </p>
                </div>
              )}

              <div className="col-span-2">
                <label className="label" htmlFor="obs-op">Observações</label>
                <textarea id="obs-op" rows={3} className="input" value={f.descricao} onChange={(e) => set('descricao')(e.target.value)} placeholder="Anotações sobre o cliente e o histórico de contato…" />
              </div>

              <div className="col-span-2">
                <label className="label" htmlFor="nota-op">Anotações internas</label>
                {notasAnteriores.length > 0 && (
                  <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {notasAnteriores.map((a, i) => (
                      <div key={i} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-bold text-amber-600 dark:text-amber-400">{a.usuario}</span>
                          <span className="num text-muted">{dataHoraBR(a.data)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm">{a.notaInterna}</p>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  id="nota-op"
                  rows={2}
                  maxLength={2000}
                  className="input !border-amber-500/40 !bg-amber-500/5"
                  value={f.notaInterna}
                  onChange={(e) => set('notaInterna')(e.target.value)}
                  placeholder="Escreva uma nova anotação interna e salve…"
                />
              </div>
            </div>
          </Secao>

          <Secao titulo="Contrato">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Campo rotulo="Número do contrato" valor={f.numero_contrato} onChange={set('numero_contrato')} />
              <Campo rotulo="Valor da parcela" valor={f.valor_parcela} onChange={set('valor_parcela')} modo="decimal" placeholder="0,00" />
              <Campo rotulo="Saldo devedor" valor={f.saldo_devedor} onChange={set('saldo_devedor')} modo="decimal" placeholder="0,00" />
              <Campo rotulo="Parcelas: total" valor={f.qtd_parcelas_total} onChange={set('qtd_parcelas_total')} modo="numeric" />
              <Campo rotulo="Parcelas: pagas" valor={f.qtd_parcelas_pagas} onChange={set('qtd_parcelas_pagas')} modo="numeric" />
              <Campo rotulo="Parcelas: futuras" valor={f.qtd_parcelas_futuras} onChange={set('qtd_parcelas_futuras')} modo="numeric" />
              <Campo rotulo="Parcelas: vencidas" valor={f.qtd_parcelas_vencidas} onChange={set('qtd_parcelas_vencidas')} modo="numeric" />
              <Campo rotulo="Taxa ao mês (%)" valor={f.taxa_mes} onChange={set('taxa_mes')} modo="decimal" placeholder="0,00" />
            </div>
          </Secao>

          {extras.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setExtrasAbertos((v) => !v)}
                className="kicker mb-2 flex items-center gap-2 hover:text-fg"
                aria-expanded={extrasAbertos}
              >
                <ChevronDown size={14} className={`transition ${extrasAbertos ? '' : '-rotate-90'}`} />
                Dados adicionais da planilha ({extras.length})
              </button>
              {extrasAbertos && (
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface2/40 p-3 md:grid-cols-3">
                  {extras.map(([k, v]) => (
                    <Campo key={k} rotulo={k} valor={v} onChange={setExtra(k)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        {onExcluir && !novo ? (
          <button
            type="button"
            className="btn-ghost text-primary"
            onClick={async () => {
              if (!window.confirm('Excluir este cliente?')) return;
              try {
                await onExcluir();
                onClose();
              } catch (e) {
                setErro(e.message);
                setAba('dados');
              }
            }}
          >
            <Trash2 size={15} /> Excluir
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={salvando || !f.nome.trim() || semReceita || semMotivo} onClick={salvar}>
            {salvando && <Loader2 size={15} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
