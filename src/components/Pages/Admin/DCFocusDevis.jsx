import { useMemo, useState, useRef } from 'react';
import { Search, ChevronDown, ChevronRight, X, Calendar, TrendingUp } from 'lucide-react';
import { fmtK, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

const PIPE_ORDER = ['Reco En cours', 'Brief en attente', 'En attente Réponse client', 'Proactif', 'Gagnés en cours', 'Perdu'];
const PIPE_COLORS = {
  'Reco En cours':             '#8b5cf6',
  'Brief en attente':          '#f39c12',
  'En attente Réponse client': '#3b82f6',
  'Proactif':                  '#06b6d4',
  'Gagnés en cours':           '#2ecc71',
  'Perdu':                     '#e74c3c',
};

function PipeBadge({ stage }) {
  const col = PIPE_COLORS[stage] || '#888';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: col + '22', color: col }}>
      {stage}
    </span>
  );
}

function probaColor(p) {
  const v = Number(p);
  return v >= 75 ? '#2ecc71' : v >= 50 ? '#f39c12' : '#e74c3c';
}

export default function DCFocusDevis({ portfolio, color }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('amount');
  const [sortDir, setSortDir] = useState(-1);
  const [selectedClient, setSelectedClient] = useState('');
  const [pipeFilter, setPipeFilter] = useState('active'); // active | all | perdu
  const [selectedDevis, setSelectedDevis] = useState(null);
  const detailRef = useRef(null);

  const allProposals = portfolio.proposals || [];

  const clients = useMemo(() => {
    const s = new Set(allProposals
      .filter(p => p.company_name)
      .map(p => p.canonical_client || p.company_name));
    return [...s].sort();
  }, [allProposals]);

  const filtered = useMemo(() => {
    let list = allProposals.filter(p => Number(p.amount) > 0 && p.company_name);
    if (pipeFilter === 'active') list = list.filter(p => p.pipe_name !== 'Perdu' && p.pipe_name !== 'Gagnés, finis et payés' && p.pipe_name !== 'Gagnés en cours');
    if (pipeFilter === 'perdu') list = list.filter(p => p.pipe_name === 'Perdu');
    if (selectedClient) list = list.filter(p => (p.canonical_client || p.company_name) === selectedClient);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => (p.title || '').toLowerCase().includes(s) || (p.canonical_client || p.company_name || '').toLowerCase().includes(s));
    }
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'probabilise') {
        av = Number(a.amount) * Number(a.probability) / 100;
        bv = Number(b.amount) * Number(b.probability) / 100;
      } else if (sortKey === 'pipe_name') {
        av = PIPE_ORDER.indexOf(a.pipe_name);
        bv = PIPE_ORDER.indexOf(b.pipe_name);
      }
      if (typeof av === 'string') return sortDir * (av || '').localeCompare(bv || '');
      return sortDir * ((Number(av) || 0) - (Number(bv) || 0));
    });
    return list;
  }, [allProposals, pipeFilter, selectedClient, search, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const active = filtered.filter(p => p.pipe_name !== 'Perdu');
    const total = active.reduce((s, p) => s + Number(p.amount), 0);
    const proba = active.reduce((s, p) => s + Number(p.amount) * Number(p.probability) / 100, 0);
    const probas = active.filter(p => Number(p.probability) > 0).map(p => Number(p.probability));
    const avgProba = probas.length > 0 ? probas.reduce((s, v) => s + v, 0) / probas.length : 0;
    return { count: active.length, total, proba, avgProba };
  }, [filtered]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  }

  function SortTh({ k, children, align = 'right' }) {
    const active = sortKey === k;
    return (
      <th onClick={() => handleSort(k)}
        className={`py-2.5 px-2 text-[11px] font-bold uppercase cursor-pointer select-none text-${align} transition-colors
          ${active ? 'text-white bg-[#222]' : 'text-[#aaa] hover:text-white'}`}>
        {children}{active ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
      </th>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Devis actifs', value: kpis.count, fmt: v => v, color: 'white' },
          { label: 'Pipeline total', value: kpis.total, fmt: fmtK, color: 'white' },
          { label: 'Probabilisé', value: kpis.proba, fmt: fmtK, color: color },
          { label: 'Proba moyenne', value: Math.round(kpis.avgProba), fmt: v => `${v}%`,
            color: kpis.avgProba >= 75 ? '#2ecc71' : kpis.avgProba >= 50 ? '#f39c12' : '#e74c3c' },
        ].map(({ label, value, fmt, color: c }) => (
          <div key={label} className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase text-[#666] tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-extrabold italic" style={{ color: c || 'white' }}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input type="text" placeholder="Rechercher un devis..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:border-[#e63946] focus:outline-none w-52" />
        </div>
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="bg-[#161616] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#e63946] focus:outline-none">
          <option value="">Tous les clients</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-0.5 bg-[#111] rounded-lg p-0.5">
          {[{ k: 'active', l: 'En cours' }, { k: 'all', l: 'Tous' }, { k: 'perdu', l: 'Perdus' }].map(f => (
            <button key={f.k} onClick={() => setPipeFilter(f.k)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors
                ${pipeFilter === f.k ? 'bg-[#2a2a2a] text-white' : 'text-[#888] hover:text-white'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#666]">{filtered.length} devis</span>
      </div>

      {/* Table */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-sm" style={{ minWidth: '780px' }}>
            <thead className="sticky top-0 z-20">
              <tr className="border-b-2 border-[#333] bg-[#111]">
                <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase text-white">Devis</th>
                <SortTh k="amount">Montant</SortTh>
                <SortTh k="probability">Proba%</SortTh>
                <SortTh k="probabilise">Probabilisé</SortTh>
                <SortTh k="pipe_name" align="left">Étape</SortTh>
                <SortTh k="projet_start">Début prévu</SortTh>
                <th className="py-2.5 px-2 text-[11px] font-bold uppercase text-[#aaa] text-left">Assigné à</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isSelected = selectedDevis?.id === p.id;
                const probabilise = Number(p.amount) * Number(p.probability) / 100;
                const client = p.canonical_client || p.company_name;
                return (
                  <tr key={p.id}
                    className={`border-b border-[#1a1a1a] cursor-pointer transition-colors ${isSelected ? 'bg-[#1a1a2a]' : 'hover:bg-[#1a1a1a]'}`}
                    onClick={() => {
                      setSelectedDevis(isSelected ? null : p);
                      if (!isSelected) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                    }}>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {isSelected ? <ChevronDown size={13} style={{ color }} className="shrink-0" /> : <ChevronRight size={13} className="text-[#555] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-white truncate max-w-[220px]">{p.title || '—'}</p>
                          <p className="text-[10px] text-[#888] truncate max-w-[220px]">{client}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-white text-xs">{fmtK(Number(p.amount))}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="text-xs font-bold" style={{ color: probaColor(p.probability) }}>{p.probability}%</span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="text-xs font-semibold" style={{ color }}>{fmtK(probabilise)}</span>
                    </td>
                    <td className="py-2.5 px-2">
                      <PipeBadge stage={p.pipe_name} />
                    </td>
                    <td className="py-2.5 px-2 text-right text-xs text-[#888]">
                      {p.projet_start ? formatDate(p.projet_start) : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-left text-xs text-[#888] capitalize">{p.assigned_to || '—'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-[#666] text-sm">Aucun devis trouvé</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#e63946]/30 bg-[#e63946]/5 font-bold">
                  <td className="py-2 px-3 text-white text-xs">TOTAL ({filtered.length})</td>
                  <td className="py-2 px-2 text-right text-white text-xs">{fmtK(filtered.reduce((s, p) => s + Number(p.amount), 0))}</td>
                  <td className="py-2 px-2 text-right text-xs text-[#888]">—</td>
                  <td className="py-2 px-2 text-right text-xs" style={{ color }}>
                    {fmtK(filtered.reduce((s, p) => s + Number(p.amount) * Number(p.probability) / 100, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-[#666]">
        {PIPE_ORDER.filter(s => s !== 'Perdu').map(stage => (
          <span key={stage} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: PIPE_COLORS[stage] }} />
            {stage}
          </span>
        ))}
        <span className="ml-auto text-[#555]">↓ Cliquer sur un devis pour le détail</span>
      </div>

      {/* Detail panel */}
      {selectedDevis && (
        <div ref={detailRef} className="bg-[#161616] border-2 rounded-xl overflow-hidden" style={{ borderColor: color + '40' }}>
          <div className="flex items-start justify-between p-5 pb-4 border-b border-[#2a2a2a]" style={{ backgroundColor: color + '08' }}>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">{selectedDevis.canonical_client || selectedDevis.company_name}</p>
              <h3 className="text-lg font-bold text-white mt-0.5">{selectedDevis.title}</h3>
            </div>
            <button onClick={() => setSelectedDevis(null)} className="text-[#666] hover:text-white p-1"><X size={18} /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Montant', value: fmtK(Number(selectedDevis.amount)), color: 'white' },
                { label: 'Probabilité', value: `${selectedDevis.probability}%`, color: probaColor(selectedDevis.probability) },
                { label: 'Probabilisé', value: fmtK(Number(selectedDevis.amount) * Number(selectedDevis.probability) / 100), color },
                { label: 'Étape', value: <PipeBadge stage={selectedDevis.pipe_name} /> },
              ].map(k => (
                <div key={k.label} className="bg-[#0d0d0d] rounded-xl p-4">
                  <p className="text-[10px] text-[#aaa] uppercase tracking-wider mb-1 font-semibold">{k.label}</p>
                  <p className="text-xl font-extrabold italic" style={{ color: k.color || undefined }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-[#0d0d0d] rounded-lg p-3">
                <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold flex items-center gap-1"><Calendar size={10} />Période prévisionnelle</p>
                <p className="text-white text-xs">{formatDate(selectedDevis.projet_start)} → {formatDate(selectedDevis.projet_stop)}</p>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-3">
                <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold">Créé le</p>
                <p className="text-white text-xs">{formatDate(selectedDevis.created_at) || '—'}</p>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-3">
                <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold">Assigné à</p>
                <p className="text-white text-xs capitalize">{selectedDevis.assigned_to || '—'}</p>
              </div>
              {selectedDevis.total_days > 0 && (
                <div className="bg-[#0d0d0d] rounded-lg p-3">
                  <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold flex items-center gap-1"><TrendingUp size={10} />Jours vendus</p>
                  <p className="text-white text-xs">{selectedDevis.total_days}j</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
