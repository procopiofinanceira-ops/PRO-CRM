import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Database, LayoutGrid, Layers, Rows3, Search, SlidersHorizontal, Upload, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useEquipe } from '../lib/useEquipe.js';
import BasesPainel from '../components/bases/BasesPainel.jsx';
import { ConvenioLinha, ConvenioQuadrado, pctDe } from '../components/bases/ConvenioVisoes.jsx';
import ConvenioDrawer from '../components/bases/ConvenioDrawer.jsx';
import DuplicadosModal from '../components/bases/DuplicadosModal.jsx';
import Importacoes from '../components/bases/Importacoes.jsx';
import TabelaBase from '../components/bases/TabelaBase.jsx';
import DistribuirModal from '../components/DistribuirModal.jsx';
import { CartoesSkeleton, EstadoVazio } from '../components/Estados.jsx';
import ImportWizard from '../components/ImportWizard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Tabs from '../components/Tabs.jsx';

const POR_PAGINA = 12;

const ORDENS = [
  { valor: 'leads', rotulo: 'Mais registros', chave: (c) => c.totalLeads },
  { valor: 'recentes', rotulo: 'Mais recentes', chave: (c) => new Date(c.ultimaAtualizacao ?? 0).getTime() },
  { valor: 'parados', rotulo: 'Menos trabalhados', chave: (c) => -pctDe(c) },
  { valor: 'sem', rotulo: 'Sem responsável', chave: (c) => c.semResponsavel },
];

export default function Bases() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useSearchParams();

  const podeImportar = usuario.perfil === 'MASTER' || (usuario.perfil !== 'PROMOTOR' && usuario.permissaoImportacao);
  const podeGerir = ['MASTER', 'SUPERVISOR'].includes(usuario.perfil);
  const promotor = usuario.perfil === 'PROMOTOR';

  const [aba, setAba] = useState('bases');
  const [q, setQ] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [importador, setImportador] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState('leads');
  const [equipe, setEquipe] = useState(''); // só o master: de qual supervisor ver as bases
  const [visao, setVisao] = useState(() => {
    try {
      return localStorage.getItem('visao:bases') === 'lista' ? 'lista' : 'quadrados';
    } catch {
      return 'quadrados';
    }
  });
  const trocarVisao = (v) => {
    setVisao(v);
    try {
      localStorage.setItem('visao:bases', v);
    } catch {
      /* sem armazenamento: só não lembra */
    }
  };

  const [tabela, setTabela] = useState(null); // { convenio: string | null, q?: string }
  const [detalhe, setDetalhe] = useState(null);
  const [distribuir, setDistribuir] = useState(null);
  const [duplicados, setDuplicados] = useState(false);
  const [importando, setImportando] = useState(false);

  const { usuarios } = useEquipe(podeGerir);

  // Links vindos da busca global: /bases?q=… abre a tabela já filtrada; /bases?importar=1 abre o assistente
  useEffect(() => {
    const termo = busca.get('q');
    const importar = busca.get('importar');
    if (termo) setTabela({ convenio: null, q: termo });
    if (importar && podeImportar) setImportando(true);
    if (termo || importar) setBusca({}, { replace: true });
  }, [busca, setBusca, podeImportar]);

  const filtrosParams = new URLSearchParams({
    ...(q.trim() && { q: q.trim() }),
    ...(importador && { importador }),
    ...(equipe && { equipe }),
    ...(de && { de }),
    ...(ate && { ate }),
  }).toString();

  const resumo = useQuery({
    queryKey: ['/bases/resumo', equipe],
    queryFn: () => api(`/bases/resumo${equipe ? `?equipe=${equipe}` : ''}`),
  });
  const convenios = useQuery({
    queryKey: ['/bases/convenios', filtrosParams],
    queryFn: () => api(`/bases/convenios${filtrosParams ? `?${filtrosParams}` : ''}`),
    select: (r) => r.itens,
    placeholderData: (anterior) => anterior,
  });

  const itens = useMemo(() => {
    const chave = ORDENS.find((o) => o.valor === ordem).chave;
    return [...(convenios.data ?? [])].sort((a, b) => chave(b) - chave(a));
  }, [convenios.data, ordem]);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const visiveis = useMemo(() => itens.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA), [itens, pagAtual]);
  const master = usuario.perfil === 'MASTER';
  const filtrosAtivos = Boolean(importador || de || ate || equipe || ordem !== 'leads');
  // Distribuir e editar só valem nas bases da própria equipe; as demais são para consulta do master
  const daMinhaEquipe = (c) => !c.donoId || c.donoId === usuario.id;

  const atualizarTudo = () => {
    qc.invalidateQueries({ queryKey: ['/bases'] });
    qc.invalidateQueries({ queryKey: ['/importacoes'] });
    qc.invalidateQueries({ queryKey: ['/leads'] });
  };

  const abrirTabela = (convenio, equipeId) => {
    setDetalhe(null);
    setTabela({ convenio, equipeId: equipeId ?? '' });
  };

  return (
    <>
      <PageHeader
        titulo={promotor ? 'Meus convênios' : 'Bases'}
        descricao={promotor ? 'As bases com leads atribuídos a você.' : 'Todas as bases de leads, por convênio, com a situação de cada uma.'}
      >
        {!promotor && (
          <button className="btn-outline relative" onClick={() => setDuplicados(true)}>
            <AlertTriangle size={15} className="text-amber-500" /> Ver duplicados
            {resumo.data?.duplicados > 0 && (
              <span className="num rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {resumo.data.duplicados.toLocaleString('pt-BR')}
              </span>
            )}
          </button>
        )}
        <button className="btn-outline" onClick={() => setTabela({ convenio: null, equipeId: master ? usuario.id : '' })}>
          <Layers size={15} /> {promotor ? 'Todos os meus leads' : 'Todos os leads'}
        </button>
        {podeImportar && (
          <button className="btn-primary" onClick={() => setImportando(true)}>
            <Upload size={15} /> Nova importação
          </button>
        )}
      </PageHeader>

      <BasesPainel r={resumo.data} podeGerir={podeGerir} />

      {podeImportar && (
        <Tabs abas={[{ valor: 'bases', rotulo: 'Bases' }, { valor: 'importacoes', rotulo: 'Importações' }]} ativa={aba} onChange={setAba} />
      )}

      {aba === 'importacoes' && podeImportar ? (
        <Importacoes verConvenio={abrirTabela} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
              <input
                className="input pl-9"
                placeholder="Buscar convênio por nome ou código…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPagina(1); }}
              />
            </div>
            <button
              className={`btn-outline ${filtrosAbertos || filtrosAtivos ? '!border-accent/60 !text-accent' : ''}`}
              onClick={() => setFiltrosAbertos((v) => !v)}
              aria-expanded={filtrosAbertos}
            >
              <SlidersHorizontal size={15} /> Filtros
              {filtrosAtivos && <span className="live-dot !bg-accent" />}
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span className="num hidden text-xs text-muted sm:inline">
                {itens.length} convênio{itens.length === 1 ? '' : 's'}
              </span>
              <div className="flex rounded-lg border border-line bg-surface2 p-0.5" role="group" aria-label="Modo de exibição">
                {[
                  ['quadrados', 'Cards', LayoutGrid],
                  ['lista', 'Lista', Rows3],
                ].map(([v, rotulo, Icone]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={visao === v}
                    onClick={() => trocarVisao(v)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      visao === v ? 'bg-primary text-white shadow-glow' : 'text-muted hover:text-text'
                    }`}
                  >
                    <Icone size={14} /> {rotulo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtrosAbertos && (
            <div className="card mb-4 grid animate-scale-in gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label" htmlFor="f-ord">Ordenar</label>
                <select id="f-ord" className="input" value={ordem} onChange={(e) => { setOrdem(e.target.value); setPagina(1); }}>
                  {ORDENS.filter((o) => podeGerir || o.valor !== 'sem').map((o) => (
                    <option key={o.valor} value={o.valor}>{o.rotulo}</option>
                  ))}
                </select>
              </div>
              {master && (
                <div>
                  <label className="label" htmlFor="f-eq">Equipe</label>
                  <select id="f-eq" className="input" value={equipe} onChange={(e) => { setEquipe(e.target.value); setPagina(1); }}>
                    <option value="">Todas as equipes</option>
                    {usuarios.filter((u) => ['SUPERVISOR', 'MASTER'].includes(u.perfil)).map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              {!promotor && (
              <>
              <div>
                <label className="label" htmlFor="f-imp">Importado por</label>
                <select id="f-imp" className="input" value={importador} onChange={(e) => { setImportador(e.target.value); setPagina(1); }}>
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="f-de">Importado de</label>
                <input id="f-de" type="date" className="input num" value={de} onChange={(e) => { setDe(e.target.value); setPagina(1); }} />
              </div>
              <div>
                <label className="label" htmlFor="f-ate">Importado até</label>
                <input id="f-ate" type="date" className="input num" value={ate} onChange={(e) => { setAte(e.target.value); setPagina(1); }} />
              </div>
              </>
              )}
              <div className="flex items-end">
                {filtrosAtivos && (
                  <button className="btn-ghost text-primary" onClick={() => { setImportador(''); setDe(''); setAte(''); setEquipe(''); setOrdem('leads'); setPagina(1); }}>
                    <X size={14} /> Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {convenios.isLoading && <CartoesSkeleton quantidade={4} />}
          {convenios.error && <p className="text-sm text-primary">{convenios.error.message}</p>}

          {!convenios.isLoading && itens.length === 0 && (
            <div className="card">
              <EstadoVazio icone={Database} texto={q || filtrosAtivos ? 'Nenhum convênio encontrado' : promotor ? 'Você ainda não recebeu leads' : 'Nenhuma base importada ainda'}
                dica={q || filtrosAtivos ? 'Ajuste a busca ou os filtros.' : promotor ? 'Quando o seu supervisor distribuir leads, as bases aparecem aqui.' : 'Importe uma planilha para criar a primeira base.'}>
                {!q && !filtrosAtivos && podeImportar && (
                  <button className="btn-primary mt-3" onClick={() => setImportando(true)}><Upload size={15} /> Nova importação</button>
                )}
              </EstadoVazio>
            </div>
          )}

          <div
            className={visao === 'lista' ? 'flex flex-col gap-3' : 'grid'}
            style={visao === 'lista' ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))', gap: '1.25rem' }}
          >
            {visiveis.map((c, i) => {
              const Item = visao === 'lista' ? ConvenioLinha : ConvenioQuadrado;
              return (
              <Item
                key={`${c.donoId ?? ''}|${c.convenio}`}
                c={c}
                indice={i}
                podeGerir={podeGerir}
                podeDistribuir={podeGerir && daMinhaEquipe(c)}
                onAbrir={() => abrirTabela(c.convenio, c.donoId)}
                onDetalhes={() => setDetalhe(c)}
                onDistribuir={() => setDistribuir(c)}
              />
              );
            })}
          </div>

          {totalPaginas > 1 && (
            <div className="num mt-6 flex items-center justify-center gap-3 text-sm text-muted">
              <button className="btn-outline !p-2" disabled={pagAtual <= 1} onClick={() => setPagina(pagAtual - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>
              <span>Página {pagAtual} de {totalPaginas}</span>
              <button className="btn-outline !p-2" disabled={pagAtual >= totalPaginas} onClick={() => setPagina(pagAtual + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {detalhe && (
        <ConvenioDrawer
          c={detalhe}
          podeGerir={podeGerir && daMinhaEquipe(detalhe)}
          onClose={() => setDetalhe(null)}
          onAbrir={() => abrirTabela(detalhe.convenio, detalhe.donoId)}
          onDistribuir={() => { setDistribuir(detalhe); setDetalhe(null); }}
        />
      )}

      {distribuir && (
        <DistribuirModal
          titulo={`Distribuir: ${distribuir.convenio}`}
          descricao={`${distribuir.semResponsavel.toLocaleString('pt-BR')} lead(s) sem responsável nesta base serão repartidos em rodízio.`}
          origens={[{ valor: distribuir.convenio, rotulo: `${distribuir.convenio} (${distribuir.semResponsavel.toLocaleString('pt-BR')} sem responsável)` }]}
          onClose={() => { setDistribuir(null); atualizarTudo(); }}
          onDistribuir={({ usuarioIds, quantidade, origem }) =>
            api('/leads/distribuir', { method: 'POST', body: { usuarioIds, quantidade, ...(origem ? { convenio: origem } : {}) } })
          }
        />
      )}

      {duplicados && (
        <DuplicadosModal
          onClose={() => setDuplicados(false)}
          onBuscar={(cpf) => { setDuplicados(false); setTabela({ convenio: null, q: cpf }); }}
        />
      )}

      {tabela && (
        <TabelaBase
          key={`${tabela.convenio ?? 'todos'}|${tabela.equipeId ?? ''}|${tabela.q ?? ''}`}
          convenio={tabela.convenio}
          equipeId={tabela.equipeId ?? ''}
          qInicial={tabela.q ?? ''}
          podeAtribuir={podeGerir}
          onClose={() => { setTabela(null); atualizarTudo(); }}
        />
      )}

      {importando && <ImportWizard onClose={() => setImportando(false)} onConcluido={atualizarTudo} />}
    </>
  );
}
