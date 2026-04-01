import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, X, Users, Calendar, TrendingUp, Layers, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import ChartWrapper from '../../Common/ChartWrapper';
import { fmtK, fmtNum, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

// MB% thresholds: ≥54% green, 45-54% orange, <45% red
function mbColor(pct) { return pct >= 54 ? '#2ecc71' : pct >= 45 ? '#f39c12' : '#e74c3c'; }

function TrafficLight({ pct }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mbColor(pct) }} />;
}

function TimeBar({ sold, spent, planned, color }) {
  const total = Math.max(sold, spent + planned, 0.1);
  const spentPct = Math.min(spent / total * 100, 100);
  const plannedPct = Math.min(planned / total * 100, 100 - spentPct);
  const soldPct = Math.min(sold / total * 100, 100);
  const overrun = spent > sold && sold > 0;
  return (
    <div className="w-full space-y-0.5">
      <div className="relative w-full h-6 bg-[#111] rounded overflow-hidden">
        {/* Spent bar */}
        <div className="absolute top-0 left-0 h-full transition-all"
          style={{ width: `${spentPct}%`, backgroundColor: overrun ? '#e74c3c' : color }} />
        {/* Planned bar (stacked after spent) */}
        {plannedPct > 0 && (
          <div className="absolute top-0 h-full transition-all"
            style={{ left: `${spentPct}%`, width: `${plannedPct}%`, backgroundColor: '#3b82f6', opacity: 0.8 }} />
        )}
        {/* Sold marker */}
        {sold > 0 && (
          <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: `${soldPct}%`, backgroundColor: 'rgba(255,255,255,0.5)' }} />
        )}
      </div>
      <div className="flex justify-between text-[9px] text-[#666]">
        <span style={{ color }}>{fmtNum(spent, 0)}j faits</span>
        {planned > 0 && <span className="text-[#3b82f6]">{fmtNum(planned, 0)}j planif.</span>}
        <span className="text-[#888]">{fmtNum(sold, 0)}j vendus</span>
      </div>
    </div>
  );
}

export default function DCFocusProjet({ portfolio, color }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('total_amount');
  const [sortDir, setSortDir] = useState(-1);
  const [selectedClient, setSelectedClient] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | open | closed
  const [selectedProject, setSelectedProject] = useState(null);
  const detailRef = useRef(null);

  const fyProjects = (portfolio.projects || []).filter(p => p.inFY);

  const clients = useMemo(() => {
    const s = new Set(fyProjects.map(p => p.canonical_client || p.company_name || 'Inconnu'));
    return [...s].sort();
  }, [fyProjects]);

  const filtered = useMemo(() => {
    let list = fyProjects;
    if (statusFilter === 'open') list = list.filter(p => p.actif === '1' || p.actif === 1);
    if (statusFilter === 'closed') list = list.filter(p => p.actif !== '1' && p.actif !== 1);
    if (selectedClient) list = list.filter(p => (p.canonical_client || p.company_name) === selectedClient);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => p.title?.toLowerCase().includes(s) || (p.canonical_client || p.company_name || '').toLowerCase().includes(s));
    }
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') return sortDir * av.localeCompare(bv || '');
      return sortDir * ((av || 0) - (bv || 0));
    });
    return list;
  }, [fyProjects, selectedClient, search, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const totalSold = filtered.reduce((s, p) => s + (p.time_sold_days || 0), 0);
    const totalFait = filtered.reduce((s, p) => s + (p.time_fait_days ?? p.time_spent_days ?? 0), 0);
    const totalPlanifie = filtered.reduce((s, p) => s + (p.time_planifie_days ?? p.time_planified_days ?? 0), 0);
    const totalRestePlanifier = Math.max(0, totalSold - totalFait - totalPlanifie);
    return {
      totalCA: filtered.reduce((s, p) => s + p.total_amount, 0),
      totalMB: filtered.reduce((s, p) => s + (p.marginEur || 0), 0),
      totalSold,
      totalFait,
      totalPlanifie,
      totalRestePlanifier,
      avgAdv: totalSold > 0 ? Math.min(Math.round(totalFait / totalSold * 1000) / 10, 100) : 0,
    };
  }, [filtered]);

  const mbPct = kpis.totalCA > 0 ? Math.round(kpis.totalMB / kpis.totalCA * 1000) / 10 : 0;

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
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Projets', value: filtered.length, fmt: v => v },
          { label: 'CA Total', value: kpis.totalCA, fmt: fmtK, suffix: '€' },
          { label: 'Marge Brute', value: kpis.totalMB, fmt: fmtK, suffix: '€', sub: `MB ${fmtPct(mbPct)}`, color: mbColor(mbPct) },
          { label: 'Jours Vendus', value: kpis.totalSold, fmt: v => `${fmtNum(v, 0)}j` },
          { label: 'Jours Faits', value: kpis.totalFait, fmt: v => `${fmtNum(v, 0)}j` },
          { label: 'Avanc. Moy.', value: Math.round(kpis.avgAdv), fmt: v => `${v}%`, color: kpis.avgAdv >= 70 ? '#2ecc71' : kpis.avgAdv >= 40 ? '#f39c12' : '#e74c3c' },
        ].map(({ label, value, fmt, suffix, sub, color: c }) => (
          <div key={label} className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase text-[#666] tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-extrabold italic" style={{ color: c || 'white' }}>
              {fmt(value)}{suffix || ''}
            </p>
            {sub && <p className="text-[10px] text-[#888] mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input type="text" placeholder="Rechercher un projet..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:border-[#e63946] focus:outline-none w-52" />
        </div>
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="bg-[#161616] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#e63946] focus:outline-none">
          <option value="">Tous les clients</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-0.5 bg-[#111] rounded-lg p-0.5">
          {[{ k: 'all', l: 'Tous' }, { k: 'open', l: 'Ouverts' }, { k: 'closed', l: 'Fermés' }].map(f => (
            <button key={f.k} onClick={() => setStatusFilter(f.k)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors
                ${statusFilter === f.k ? 'bg-[#2a2a2a] text-white' : 'text-[#888] hover:text-white'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#666]">{filtered.length} projet{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '900px' }}>
            <thead className="sticky top-0 z-20">
              <tr className="border-b-2 border-[#333] bg-[#111]">
                <th className="text-left py-2.5 px-3 text-[11px] font-bold uppercase text-white">Projet</th>
                <SortTh k="total_amount">CA +</SortTh>
                <SortTh k="margin">MB%</SortTh>
                <SortTh k="marginEur">MB€</SortTh>
                <SortTh k="time_sold_days">Vendus</SortTh>
                <SortTh k="time_fait_days">Faits</SortTh>
                <SortTh k="time_planifie_days">Planifiés</SortTh>
                <th className="py-2.5 px-2 text-[11px] font-bold uppercase text-[#f39c12]">Reste</th>
                <SortTh k="advancement">Avanc.</SortTh>
                <th className="py-2.5 px-3 text-[11px] font-bold uppercase text-[#aaa] min-w-[160px]">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isSelected = selectedProject?.id === p.id;
                const timeFait = p.time_fait_days ?? p.time_spent_days ?? 0;
                const timePlanifie = p.time_planifie_days ?? p.time_planified_days ?? 0;
                const timeSold = p.time_sold_days || 0;
                const resteAPlanifier = Math.max(0, timeSold - timeFait - timePlanifie);
                const adv = timeSold > 0 ? Math.min(Math.round(timeFait / timeSold * 1000) / 10, 100) : p.advancement || 0;
                const advColor = adv >= 70 ? '#2ecc71' : adv >= 40 ? '#f39c12' : '#e74c3c';
                return (
                  <tr key={p.id}
                    className={`border-b border-[#1a1a1a] cursor-pointer transition-colors ${isSelected ? 'bg-[#1a1a2a]' : 'hover:bg-[#1a1a1a]'}`}
                    onClick={() => {
                      setSelectedProject(isSelected ? null : p);
                      if (!isSelected) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                    }}>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {isSelected ? <ChevronDown size={13} style={{ color }} className="shrink-0" /> : <ChevronRight size={13} className="text-[#555] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-white truncate max-w-[200px]">{p.title}</p>
                          <p className="text-[10px] text-[#888] truncate max-w-[200px]">{p.canonical_client || p.company_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-white text-xs">{fmtK(p.total_amount)}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <TrafficLight pct={p.margin} />
                        <span className="text-xs font-bold" style={{ color: mbColor(p.margin) }}>{fmtPct(p.margin)}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right text-xs text-white">{fmtK(p.marginEur || 0)}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-white">{timeSold > 0 ? `${fmtNum(timeSold, 0)}j` : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-white">{timeFait > 0 ? `${fmtNum(timeFait, 0)}j` : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-[#3b82f6]">{timePlanifie > 0 ? `${fmtNum(timePlanifie, 0)}j` : '—'}</td>
                    <td className="py-2.5 px-2 text-right text-xs text-[#f39c12]">{resteAPlanifier > 0 ? `${fmtNum(resteAPlanifier, 0)}j` : <span className="text-[#2ecc71]">✓</span>}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="text-xs font-bold" style={{ color: advColor }}>{Math.round(adv)}%</span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[160px]">
                      <TimeBar sold={timeSold} spent={timeFait} planned={timePlanifie} color={color} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-[#666] text-sm">Aucun projet trouvé</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#e63946]/30 bg-[#e63946]/5 font-bold">
                  <td className="py-2 px-3 text-white text-xs">TOTAL ({filtered.length})</td>
                  <td className="py-2 px-2 text-right text-white text-xs">{fmtK(kpis.totalCA)}</td>
                  <td className="py-2 px-2 text-right text-xs">
                    <span style={{ color: mbColor(mbPct) }}>{fmtPct(mbPct)}</span>
                  </td>
                  <td className="py-2 px-2 text-right text-[#ccc] text-xs">{fmtK(kpis.totalMB)}</td>
                  <td className="py-2 px-2 text-right text-[#ccc] text-xs">{fmtNum(kpis.totalSold, 0)}j</td>
                  <td className="py-2 px-2 text-right text-[#ccc] text-xs">{fmtNum(kpis.totalFait, 0)}j</td>
                  <td className="py-2 px-2 text-right text-[#3b82f6] text-xs">{fmtNum(kpis.totalPlanifie, 0)}j</td>
                  <td className="py-2 px-2 text-right text-[#f39c12] text-xs">{fmtNum(kpis.totalRestePlanifier, 0)}j</td>
                  <td colSpan={2} className="py-2 px-2 text-right text-[#888] text-xs">{Math.round(kpis.avgAdv)}% moy.</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-[#666] flex-wrap">
        <span><span className="inline-block w-3 h-2 rounded-sm mr-1" style={{ backgroundColor: color }} />Jours faits</span>
        <span><span className="inline-block w-3 h-2 rounded-sm mr-1 bg-[#3b82f6]" style={{ opacity: 0.8 }} />Jours planifiés</span>
        <span><span className="inline-block w-px h-3 mr-1 bg-white/50" />Vendus (repère)</span>
        <span className="text-[#f39c12]">■ Reste à planifier</span>
        <span>MB% : <span className="text-[#2ecc71]">≥54%</span> <span className="text-[#f39c12]">45-54%</span> <span className="text-[#e74c3c]">&lt;45%</span></span>
        <span className="ml-auto text-[#555]">↓ Cliquer sur un projet pour le détail</span>
      </div>

      {/* Project detail panel */}
      {selectedProject && (
        <div ref={detailRef} className="bg-[#161616] border-2 rounded-xl overflow-hidden" style={{ borderColor: color + '40' }}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-4 border-b border-[#2a2a2a]" style={{ backgroundColor: color + '08' }}>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">{selectedProject.canonical_client || selectedProject.company_name}</p>
              <h3 className="text-lg font-bold text-white mt-0.5">{selectedProject.title}</h3>
            </div>
            <button onClick={() => setSelectedProject(null)} className="text-[#666] hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'CA Net', value: fmtK(selectedProject.total_amount), color: 'white' },
                { label: 'Marge Brute', value: `${fmtK(selectedProject.marginEur || 0)} (${fmtPct(selectedProject.margin)})`, color: mbColor(selectedProject.margin) },
                { label: 'Statut', value: (selectedProject.actif === '1' || selectedProject.actif === 1) ? 'Actif' : 'Fermé', color: (selectedProject.actif === '1' || selectedProject.actif === 1) ? '#2ecc71' : '#e74c3c' },
                { label: 'Avancement', value: (() => { const f = selectedProject.time_fait_days ?? 0, s = selectedProject.time_sold_days ?? 0; return s > 0 ? `${Math.round(f/s*100)}%` : '—'; })(), color: (() => { const f = selectedProject.time_fait_days ?? 0, s = selectedProject.time_sold_days ?? 0; const a = s > 0 ? f/s*100 : 0; return a >= 70 ? '#2ecc71' : a >= 40 ? '#f39c12' : '#e74c3c'; })() },
              ].map(k => (
                <div key={k.label} className="bg-[#0d0d0d] rounded-xl p-4">
                  <p className="text-[10px] text-[#aaa] uppercase tracking-wider mb-1 font-semibold">{k.label}</p>
                  <p className="text-xl font-extrabold italic" style={{ color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-[#0d0d0d] rounded-lg p-3">
                <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold flex items-center gap-1"><Calendar size={10} />Période</p>
                <p className="text-white text-xs">{formatDate(selectedProject.start_date)} → {formatDate(selectedProject.end_date)}</p>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-3">
                <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold">Type</p>
                <p className="text-white text-xs">{selectedProject.type_label || '—'}</p>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-3">
                <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold">Chef de projet</p>
                <p className="text-white text-xs">{selectedProject.project_manager || '—'}</p>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-3">
                <p className="text-[10px] text-[#aaa] uppercase mb-1 font-semibold">Créé le</p>
                <p className="text-white text-xs">{formatDate(selectedProject.created_at) || '—'}</p>
              </div>
            </div>

            {/* Jours timeline */}
            <div className="bg-[#0d0d0d] rounded-xl p-4">
              <p className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5"><TrendingUp size={12} />Répartition des jours</p>
              {(() => {
                const sold = selectedProject.time_sold_days || 0;
                const fait = selectedProject.time_fait_days ?? selectedProject.time_spent_days ?? 0;
                const plan = selectedProject.time_planifie_days ?? selectedProject.time_planified_days ?? 0;
                const reste = Math.max(0, sold - fait - plan);
                return (
                  <div className="space-y-3">
                    <div className="mb-2">
                      <TimeBar sold={sold} spent={fait} planned={plan} color={color} />
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {[
                        { label: 'Vendus', val: sold, c: '#888' },
                        { label: 'Faits', val: fait, c: color },
                        { label: 'Planifiés', val: plan, c: '#3b82f6' },
                        { label: 'Reste à planifier', val: reste, c: reste > 0 ? '#f39c12' : '#2ecc71' },
                      ].map(k => (
                        <div key={k.label} className="bg-[#111] rounded-lg p-2">
                          <p className="text-[9px] text-[#aaa] uppercase font-semibold">{k.label}</p>
                          <p className="text-base font-extrabold italic" style={{ color: k.c }}>{fmtNum(k.val, 0)}j</p>
                        </div>
                      ))}
                    </div>
                    {selectedProject.achatsMedias > 0 && (
                      <p className="text-[10px] text-[#888]">Dont {fmtK(selectedProject.achatsMedias)} Achats Médias retraités du CA</p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Graphique jours par mois */}
            {selectedProject.monthlyCollab && Object.keys(selectedProject.monthlyCollab).length > 0 && (
              <MonthlyChart monthlyCollab={selectedProject.monthlyCollab} color={color} />
            )}

            {/* Collaborateurs par mois */}
            {selectedProject.monthlyCollab && Object.keys(selectedProject.monthlyCollab).length > 0 && (
              <CollabTable monthlyCollab={selectedProject.monthlyCollab} color={color} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// FY months list for table headers
const FY_MONTHS = [];
for (let m = 6; m < 18; m++) {
  const y = m < 12 ? 2025 : 2026;
  const mo = m % 12;
  FY_MONTHS.push({
    key: `${y}-${String(mo + 1).padStart(2, '0')}`,
    label: new Date(y, mo).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
  });
}

function MonthlyChart({ monthlyCollab, color }) {
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const data = FY_MONTHS.map(m => {
    let fait = 0, planifie = 0;
    Object.values(monthlyCollab).forEach(personMonths => {
      fait += (personMonths[m.key]?.fait || 0);
      planifie += (personMonths[m.key]?.planifie || 0);
    });
    return { label: m.label, key: m.key, fait: Math.round(fait * 10) / 10, planifie: Math.round(planifie * 10) / 10, isCurrent: m.key === currentMonthKey };
  }).filter(m => m.fait > 0 || m.planifie > 0);

  if (data.length === 0) return null;

  return (
    <div className="bg-[#0d0d0d] rounded-xl p-4">
      <p className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <BarChart2 size={12} />Jours passés par mois
      </p>
      <div className="flex items-center gap-4 mb-3 text-[10px] text-[#888]">
        <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: color }} />Faits</span>
        <span><span className="inline-block w-2 h-2 rounded-sm mr-1 bg-[#3b82f6]" />Planifiés</span>
      </div>
      <ChartWrapper height={160}>
        <BarChart data={data} barSize={16}>
          <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff' }}
            formatter={(v, name) => [`${v}j`, name]}
            labelStyle={{ color: '#ccc' }}
          />
          <Bar dataKey="fait" name="Jours faits" radius={[3, 3, 0, 0]}>
            {data.map((m, i) => <Cell key={i} fill={m.isCurrent ? `${color}cc` : color} />)}
          </Bar>
          <Bar dataKey="planifie" name="Jours planifiés" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.8} />
        </BarChart>
      </ChartWrapper>
    </div>
  );
}

function CollabTable({ monthlyCollab, color }) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const people = useMemo(() => {
    // Sort by total days descending
    return Object.entries(monthlyCollab).map(([person, months]) => {
      const total = Object.values(months).reduce((s, m) => s + m.fait + m.planifie, 0);
      return { person, months, total };
    }).sort((a, b) => b.total - a.total);
  }, [monthlyCollab]);

  // Only show months with data
  const activeMonths = FY_MONTHS.filter(m => people.some(p => p.months[m.key]));

  if (people.length === 0) return null;

  return (
    <div className="bg-[#0d0d0d] rounded-xl p-4">
      <p className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Users size={12} />Collaborateurs — jours par mois
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs w-full" style={{ minWidth: `${180 + activeMonths.length * 55}px` }}>
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left py-1.5 px-2 text-[10px] text-[#666] uppercase font-bold w-36">Collaborateur</th>
              <th className="text-right py-1.5 px-2 text-[10px] text-[#888] uppercase font-bold">Total</th>
              {activeMonths.map(m => (
                <th key={m.key} className={`text-center py-1.5 px-1 text-[10px] font-bold ${m.key === currentMonthKey ? 'text-[#e63946]' : 'text-[#666]'}`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map(({ person, months, total }) => (
              <tr key={person} className="border-b border-[#1a1a1a]">
                <td className="py-1.5 px-2 text-white font-medium capitalize">{person}</td>
                <td className="py-1.5 px-2 text-right font-bold text-white">{fmtNum(total, 1)}j</td>
                {activeMonths.map(m => {
                  const d = months[m.key];
                  const fait = d?.fait || 0;
                  const plan = d?.planifie || 0;
                  const isCurrent = m.key === currentMonthKey;
                  return (
                    <td key={m.key} className={`py-1.5 px-1 text-center ${isCurrent ? 'bg-[#e63946]/5' : ''}`}>
                      {fait > 0 && <div className="text-[10px] font-semibold" style={{ color }}>{fmtNum(fait, 0)}j</div>}
                      {plan > 0 && <div className="text-[10px] text-[#3b82f6]">{fmtNum(plan, 0)}j</div>}
                      {!fait && !plan && <span className="text-[#333]">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#2a2a2a]">
              <td className="py-1.5 px-2 text-[#888] text-[10px]">TOTAL</td>
              <td className="py-1.5 px-2 text-right font-bold text-white">{fmtNum(people.reduce((s, p) => s + p.total, 0), 1)}j</td>
              {activeMonths.map(m => {
                const monthTotal = people.reduce((s, p) => s + (p.months[m.key]?.fait || 0) + (p.months[m.key]?.planifie || 0), 0);
                return (
                  <td key={m.key} className="py-1.5 px-1 text-center text-[10px] text-white font-medium">
                    {monthTotal > 0 ? `${fmtNum(monthTotal, 0)}j` : '—'}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
