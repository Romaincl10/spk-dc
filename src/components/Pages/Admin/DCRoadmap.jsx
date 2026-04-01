import { useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { fmtK, fmtNum } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

// All FY months
const ALL_FY_MONTHS = [];
for (let m = 6; m < 18; m++) {
  const y = m < 12 ? 2025 : 2026;
  const mo = m % 12;
  ALL_FY_MONTHS.push({
    key: `${y}-${String(mo + 1).padStart(2, '0')}`,
    label: new Date(y, mo).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
    year: y, month: mo,
    start: new Date(y, mo, 1),
    end: new Date(y, mo + 1, 0),
  });
}

const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function getVisibleMonths(period) {
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  if (period === 'mois') {
    return ALL_FY_MONTHS.filter(m => m.key === currentMonthKey);
  }
  if (period === 'trimestre') {
    // current calendar quarter
    const qStart = Math.floor(nowMonth / 3) * 3;
    return ALL_FY_MONTHS.filter(m => m.year === nowYear && m.month >= qStart && m.month < qStart + 3);
  }
  if (period === 'semestre') {
    // H2 of FY = Jan-Jun 2026, H1 = Jul-Dec 2025
    const isH2 = nowYear === 2026 && nowMonth < 6;
    if (isH2) return ALL_FY_MONTHS.filter(m => m.year === 2026);
    return ALL_FY_MONTHS.filter(m => m.year === 2025);
  }
  return ALL_FY_MONTHS; // exercice complet
}

function isActiveInMonth(startDate, endDate, month) {
  const s = startDate ? new Date(startDate) : null;
  const e = endDate || startDate ? new Date(endDate || startDate) : null;
  if (!s) return false;
  return !(e < month.start || s > month.end);
}

const PERIOD_OPTIONS = [
  { key: 'exercice', label: 'Exercice' },
  { key: 'semestre', label: 'Semestre' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'mois', label: 'Mois' },
];

export default function DCRoadmap({ portfolio, color, viewMode = 'signe' }) {
  const [search, setSearch] = useState('');
  const [collapsedClients, setCollapsedClients] = useState({});
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [period, setPeriod] = useState('exercice');
  const [statusFilter, setStatusFilter] = useState('all'); // all | open | closed

  const allFyProjects = (portfolio.projects || []).filter(p => p.inFY);
  const fyProjects = useMemo(() => {
    if (statusFilter === 'open') return allFyProjects.filter(p => p.actif === '1' || p.actif === 1);
    if (statusFilter === 'closed') return allFyProjects.filter(p => p.actif !== '1' && p.actif !== 1);
    return allFyProjects;
  }, [allFyProjects, statusFilter]);
  const clientBreakdown = portfolio.clientBreakdown || [];

  const isProjection = viewMode === 'projection';
  const FY_MONTHS = useMemo(() => getVisibleMonths(period), [period]);

  // Build devis by canonical client (for projection mode), filter proba >= 50
  const devisByClient = useMemo(() => {
    const map = {};
    clientBreakdown.forEach(c => {
      const qualified = (c.devis || []).filter(d => (Number(d.probability) || 0) >= 50);
      if (qualified.length > 0) map[c.name] = qualified;
    });
    return map;
  }, [clientBreakdown]);

  const clientGroups = useMemo(() => {
    const map = {};

    fyProjects.forEach(p => {
      // Filtrer : ne garder que les projets actifs sur au moins un mois de la période sélectionnée
      const activeInPeriod = FY_MONTHS.some(m => isActiveInMonth(p.start_date, p.end_date, m));
      if (!activeInPeriod) return;

      const name = p.canonical_client || p.company_name || 'Inconnu';
      if (!map[name]) map[name] = { name, projects: [], devis: [], ca: 0, pipe: 0, activeMonths: new Set() };
      map[name].projects.push(p);
      map[name].ca += p.total_amount;
      FY_MONTHS.forEach(m => { if (isActiveInMonth(p.start_date, p.end_date, m)) map[name].activeMonths.add(m.key); });
    });

    if (isProjection) {
      Object.entries(devisByClient).forEach(([clientName, devis]) => {
        // Filtrer devis actifs sur la période
        const periodDevis = devis.filter(d => FY_MONTHS.some(m => isActiveInMonth(d.projet_start, d.projet_stop, m)));
        if (periodDevis.length === 0) return;

        if (!map[clientName]) map[clientName] = { name: clientName, projects: [], devis: [], ca: 0, pipe: 0, activeMonths: new Set() };
        map[clientName].devis = periodDevis;
        map[clientName].pipe = periodDevis.reduce((s, d) => s + (d.probabilise || 0), 0);
        periodDevis.forEach(d => {
          FY_MONTHS.forEach(m => { if (isActiveInMonth(d.projet_start, d.projet_stop, m)) map[clientName].activeMonths.add(m.key); });
        });
      });
    }

    let list = Object.values(map).sort((a, b) => (b.ca + b.pipe) - (a.ca + a.pipe));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s) ||
        c.projects.some(p => p.title.toLowerCase().includes(s)) ||
        c.devis.some(d => d.title?.toLowerCase().includes(s)));
    }
    return list;
  }, [fyProjects, search, devisByClient, isProjection, FY_MONTHS]);

  const toggleClient = (name) => setCollapsedClients(prev => ({ ...prev, [name]: !prev[name] }));

  const toggleAll = () => {
    const newState = !allCollapsed;
    const newCollapsed = {};
    clientGroups.forEach(c => { newCollapsed[c.name] = newState; });
    setCollapsedClients(newCollapsed);
    setAllCollapsed(newState);
  };

  const totalActiveProjects = fyProjects.filter(p =>
    isActiveInMonth(p.start_date, p.end_date, {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    })
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Roadmap — Exercice 2025/2026</h3>
          <p className="text-xs text-[#888]">
            {fyProjects.length} projets — {clientGroups.length} clients — {totalActiveProjects} actifs ce mois
            {isProjection && Object.keys(devisByClient).length > 0 && (
              <span className="text-[#3b82f6] ml-2">
                + {Object.values(devisByClient).reduce((s, d) => s + d.length, 0)} devis ≥50%
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period selector */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[#555] px-0.5">Période</span>
            <div className="flex gap-0.5 bg-[#0d1117] border border-[#1e3a5f] rounded-lg p-0.5">
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => setPeriod(opt.key)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors
                    ${period === opt.key ? 'bg-[#1e3a5f] text-[#60a5fa]' : 'text-[#4a6fa5] hover:text-[#93c5fd]'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Divider */}
          <div className="w-px h-8 bg-[#2a2a2a] self-end mb-0.5" />
          {/* Status filter */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[#555] px-0.5">Projets</span>
            <div className="flex gap-0.5 bg-[#111a11] border border-[#1e4a2a] rounded-lg p-0.5">
              {[{ k: 'all', l: 'Tous' }, { k: 'open', l: 'Ouverts' }, { k: 'closed', l: 'Fermés' }].map(f => (
                <button key={f.k} onClick={() => setStatusFilter(f.k)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors
                    ${statusFilter === f.k ? 'bg-[#1e4a2a] text-[#4ade80]' : 'text-[#3a6a4a] hover:text-[#86efac]'}`}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
          {isProjection && (
            <div className="flex items-center gap-3 text-[10px] text-[#888]">
              <span><span className="inline-block w-3 h-2 rounded-sm mr-1" style={{ backgroundColor: color }} />Signés</span>
              <span><span className="inline-block w-3 h-2 rounded-sm mr-1 bg-[#3b82f6]" />Devis ≥50%</span>
            </div>
          )}
          <button onClick={toggleAll} className="flex items-center gap-1 text-xs text-[#888] hover:text-white bg-[#161616] border border-[#2a2a2a] rounded-lg px-3 py-1.5">
            {allCollapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            {allCollapsed ? 'Développer' : 'Réduire'}
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:border-[#e63946] focus:outline-none w-44" />
          </div>
        </div>
      </div>

      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${360 + FY_MONTHS.length * 55}px` }}>
            {/* Month headers */}
            <div className="flex border-b border-[#2a2a2a] sticky top-0 bg-[#161616] z-10">
              <div className="w-[240px] shrink-0 px-3 py-2 text-xs font-bold text-[#888] uppercase">Client / Projet</div>
              <div className="w-[70px] shrink-0 px-1 py-2 text-xs font-bold text-[#888] text-right">CA</div>
              <div className="w-[50px] shrink-0 px-1 py-2 text-xs font-bold text-[#888] text-center">Jrs</div>
              {FY_MONTHS.map(m => (
                <div key={m.key} className={`flex-1 min-w-[50px] px-1 py-2 text-center text-[10px] font-bold uppercase
                  ${m.key === currentMonthKey ? 'text-[#e63946] bg-[#e63946]/5' : 'text-[#ccc]'}`}>
                  {m.label}{m.key === currentMonthKey ? ' ◆' : ''}
                </div>
              ))}
            </div>

            {clientGroups.map(client => {
              const isCollapsed = collapsedClients[client.name];
              const projectCount = client.projects.length;
              return (
                <div key={client.name}>
                  {/* Client row — unchanged in projection mode */}
                  <div className="flex border-b border-[#2a2a2a] hover:bg-[#1a1a1a] cursor-pointer" onClick={() => toggleClient(client.name)}>
                    <div className="w-[240px] shrink-0 px-3 py-2.5 flex items-center gap-1.5">
                      {isCollapsed ? <ChevronRight size={14} className="text-[#888]" /> : <ChevronDown size={14} className="text-[#888]" />}
                      <span className="text-xs font-bold text-white truncate">{client.name}</span>
                      <span className="text-[10px] text-[#666] ml-1 shrink-0">({projectCount})</span>
                    </div>
                    <div className="w-[70px] shrink-0 px-1 py-2.5 text-xs font-bold text-right">
                      <span className="text-white">{fmtK(client.ca)}</span>
                      {isProjection && client.pipe > 0 && (
                        <div className="text-[10px] text-[#3b82f6]">+{fmtK(client.pipe)}</div>
                      )}
                    </div>
                    <div className="w-[50px] shrink-0 px-1 py-2.5 text-[10px] text-[#888] text-center">
                      {fmtNum(client.projects.reduce((s, p) => s + p.time_sold_days, 0), 0)}j
                    </div>
                    {FY_MONTHS.map(m => {
                      const activeCount = client.projects.filter(p => isActiveInMonth(p.start_date, p.end_date, m)).length;
                      const devisCount = isProjection ? (client.devis || []).filter(d => isActiveInMonth(d.projet_start, d.projet_stop, m)).length : 0;
                      const isCurrent = m.key === currentMonthKey;
                      return (
                        <div key={m.key} className={`flex-1 min-w-[50px] px-0.5 py-2.5 flex items-center justify-center gap-0.5 ${isCurrent ? 'bg-[#e63946]/5' : ''}`}>
                          {activeCount > 0 && (
                            <div className="flex-1 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ backgroundColor: `${color}${activeCount > 2 ? '90' : '50'}` }}>
                              {activeCount}
                            </div>
                          )}
                          {devisCount > 0 && (
                            <div className="flex-1 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white bg-[#3b82f6]/50">
                              {devisCount}d
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Project rows */}
                  {!isCollapsed && (
                    <>
                      {client.projects
                        .sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0))
                        .map(p => (
                          <div key={p.id} className="flex border-b border-[#0a0a0a] hover:bg-[#111]"
                            title={`${p.title}\n${formatDate(p.start_date)} → ${formatDate(p.end_date)}\nVendus: ${fmtNum(p.time_sold_days, 1)}j`}>
                            <div className="w-[240px] shrink-0 px-3 py-1 pl-8 flex items-center">
                              <span className="text-[11px] text-[#ccc] truncate">{p.title}</span>
                            </div>
                            <div className="w-[70px] shrink-0 px-1 py-1 text-[10px] text-[#888] text-right">{fmtK(p.total_amount)}</div>
                            <div className="w-[50px] shrink-0 px-1 py-1 text-[10px] text-center text-[#888]">
                              {p.time_sold_days > 0 ? `${fmtNum(p.time_sold_days, 0)}j` : '—'}
                            </div>
                            {FY_MONTHS.map(m => {
                              const active = isActiveInMonth(p.start_date, p.end_date, m);
                              const isStart = p.start_date && new Date(p.start_date).getMonth() === m.month && new Date(p.start_date).getFullYear() === m.year;
                              const isEnd = p.end_date && new Date(p.end_date).getMonth() === m.month && new Date(p.end_date).getFullYear() === m.year;
                              const isCurrent = m.key === currentMonthKey;
                              return (
                                <div key={m.key} className={`flex-1 min-w-[50px] px-0.5 py-1 flex items-center ${isCurrent ? 'bg-[#e63946]/5' : ''}`}>
                                  {active && (
                                    <div className="w-full h-3 flex items-center" style={{
                                      backgroundColor: `${color}35`,
                                      borderLeft: isStart ? `3px solid ${color}` : 'none',
                                      borderRight: isEnd ? `3px solid ${color}` : 'none',
                                      borderRadius: `${isStart ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isStart ? '4px' : '0'}`,
                                    }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}

                      {/* Devis rows (projection mode, proba >= 50) */}
                      {isProjection && (client.devis || []).length > 0 && (
                        <>
                          <div className="flex border-b border-[#0a0a0a] bg-[#3b82f6]/5">
                            <div className="w-[240px] shrink-0 px-3 py-0.5 pl-8">
                              <span className="text-[9px] font-bold text-[#3b82f6] uppercase tracking-wider">Devis en cours (≥50%)</span>
                            </div>
                            <div className="flex-1" />
                          </div>
                          {(client.devis || [])
                            .sort((a, b) => new Date(a.projet_start || 0) - new Date(b.projet_start || 0))
                            .map(d => (
                              <div key={d.id} className="flex border-b border-[#0a0a0a] hover:bg-[#3b82f6]/5"
                                title={`${d.title}\n${formatDate(d.projet_start)} → ${formatDate(d.projet_stop)}\nMontant: ${fmtK(d.amount)} — Proba: ${d.probability}% — Probabilisé: ${fmtK(d.probabilise)}`}>
                                <div className="w-[240px] shrink-0 px-3 py-1 pl-10 flex items-center gap-1.5">
                                  <span className="text-[11px] text-[#3b82f6] truncate italic">{d.title}</span>
                                </div>
                                <div className="w-[70px] shrink-0 px-1 py-1 text-[10px] text-[#3b82f6] text-right">{fmtK(d.amount)}</div>
                                <div className="w-[50px] shrink-0 px-1 py-1 text-[10px] text-center text-[#3b82f6]">{d.probability}%</div>
                                {FY_MONTHS.map(m => {
                                  const active = isActiveInMonth(d.projet_start, d.projet_stop, m);
                                  const isStart = d.projet_start && new Date(d.projet_start).getMonth() === m.month && new Date(d.projet_start).getFullYear() === m.year;
                                  const isEnd = d.projet_stop && new Date(d.projet_stop).getMonth() === m.month && new Date(d.projet_stop).getFullYear() === m.year;
                                  const isCurrent = m.key === currentMonthKey;
                                  return (
                                    <div key={m.key} className={`flex-1 min-w-[50px] px-0.5 py-1 flex items-center ${isCurrent ? 'bg-[#e63946]/5' : ''}`}>
                                      {active && (
                                        <div className="w-full h-3 flex items-center" style={{
                                          backgroundColor: '#3b82f630',
                                          borderLeft: isStart ? '3px solid #3b82f6' : 'none',
                                          borderRight: isEnd ? '3px solid #3b82f6' : 'none',
                                          borderTop: '1px dashed #3b82f660',
                                          borderBottom: '1px dashed #3b82f660',
                                          borderRadius: `${isStart ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isEnd ? '4px' : '0'} ${isStart ? '4px' : '0'}`,
                                        }} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
