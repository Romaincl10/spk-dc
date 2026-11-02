import { useState, useEffect, useMemo } from 'react';
import { Crosshair, TrendingUp, Briefcase, FileText, ChevronRight, Sparkles, Swords, Layers, AlertTriangle, BarChart3, Flame } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import ObjectiveGauge from '../../Common/ObjectiveGauge';
import DCFarming from './DCFarming';
import { apiFetch } from '../../../utils/api';
import { fmtK, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;

export default function DirecteurCommercial({ fyStartYear }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('portefeuille'); // 'portefeuille' | 'planjeu'
  const [selected, setSelected] = useState(null); // client name pour le détail

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelected(null);
    apiFetch(`/api/data/biz-dev?fy=${fyStartYear}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[BizDev]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fyStartYear]);

  const clients = data?.clients || [];
  const totals = data?.totals || { count: 0, caSigne: 0, mbEur: 0, pipe: 0, projects: 0, devis: 0, margePct: 0 };
  const selectedClient = selected ? clients.find(c => c.name === selected) : null;

  // Tous les devis Biz Dev à plat (avec le client)
  const allDevis = useMemo(() => clients.flatMap(c => (c.devis || []).map(d => ({ ...d, client: c.name }))), [clients]);

  // Point 5 — Cadence des entrées : nouveaux clients par mois sur l'exercice (par firstMove)
  const cadence = useMemo(() => {
    const by = {};
    clients.forEach(c => { const m = c.firstMove ? String(c.firstMove).slice(0, 7) : null; if (!m) return; (by[m] = by[m] || { n: 0, ca: 0 }); by[m].n++; by[m].ca += c.caSigne || 0; });
    const nowKey = new Date().toISOString().slice(0, 7);
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(fyStartYear, 6 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), isCurrent: key === nowKey, n: by[key]?.n || 0, ca: by[key]?.ca || 0 });
    }
    return months;
  }, [clients, fyStartYear]);
  const maxN = Math.max(1, ...cadence.map(m => m.n));

  // Point 2 — Santé du pipe : par stade, concentration, devis à relancer
  const stages = useMemo(() => {
    const by = {};
    allDevis.forEach(d => { const s = d.pipe_name || 'Autre'; (by[s] = by[s] || { n: 0, brut: 0, pond: 0 }); by[s].n++; by[s].brut += d.amount || 0; by[s].pond += d.probabilise || 0; });
    return Object.entries(by).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.pond - a.pond);
  }, [allDevis]);
  const topDeals = useMemo(() => [...allDevis].sort((a, b) => b.probabilise - a.probabilise).slice(0, 5), [allDevis]);
  const top3Share = totals.pipe > 0 ? Math.round(topDeals.slice(0, 3).reduce((s, d) => s + (d.probabilise || 0), 0) / totals.pipe * 100) : 0;
  const stale = useMemo(() => {
    const now = Date.now();
    return allDevis
      .map(d => ({ ...d, age: d.created_at ? Math.floor((now - new Date(d.created_at).getTime()) / 86400000) : null }))
      .filter(d => d.age != null && d.age >= 45)
      .sort((a, b) => b.age - a.age);
  }, [allDevis]);
  const STAGE_COLOR = { 'Reco En cours': '#8b5cf6', 'Brief en attente': '#3b82f6', 'En attente Réponse client': '#f39c12', 'Proactif': '#06b6d4', 'Gagnés en cours': '#2ecc71' };
  const stageCol = (n) => STAGE_COLOR[n] || '#888';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center">
          <Crosshair size={20} className="text-[#8b5cf6]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Biz Dev · Nouveaux clients</h2>
          <p className="text-[#888] text-sm">
            Sociétés jamais mouvementées auparavant, entrées en relation sur l'exercice {fyLabel(fyStartYear)}
          </p>
        </div>
      </div>

      {/* Bascule Portefeuille / Plan de jeu */}
      <div className="flex gap-1 bg-[#111] rounded-lg p-0.5 w-fit">
        <button onClick={() => setTab('portefeuille')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${tab === 'portefeuille' ? 'bg-[#8b5cf6] text-white' : 'text-[#888] hover:text-white'}`}>Portefeuille</button>
        <button onClick={() => setTab('planjeu')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${tab === 'planjeu' ? 'bg-[#8b5cf6] text-white' : 'text-[#888] hover:text-white'}`}><Swords size={13} /> Plan de jeu</button>
      </div>

      {tab === 'planjeu' && <DCFarming dc="BizDev" mode="planjeu" />}
      {tab === 'portefeuille' && loading && (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>
      )}
      {tab === 'portefeuille' && !loading && (<>

      {/* KPIs Biz Dev */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Nouveaux clients" value={totals.count} icon={<Sparkles size={16} />} color="text-[#8b5cf6]" />
        <KPICard label="CA signé" value={totals.caSigne} suffix="€"
          subtitle={`MB ${fmtPct(totals.margePct || 0)}`} />
        <KPICard label="Pipe pondéré" value={totals.pipe} suffix="€" color="text-[#3b82f6]" />
        <KPICard label="Projets / Devis" value={totals.projects} suffix={` / ${totals.devis}`} />
      </div>

      {/* Jauge objectif Biz Dev */}
      <ObjectiveGauge
        label={`Objectif Biz Dev · exercice ${fyLabel(fyStartYear)}`}
        realized={totals.caSigne} target={data?.objTarget || 2300000}
        pipe={totals.pipe} pace={data?.pctTemps || 0} color="#8b5cf6" />

      {clients.length === 0 ? (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-10 text-center">
          <Sparkles size={28} className="text-[#444] mx-auto mb-3" />
          <p className="text-[#888] text-sm">Aucun nouveau client sur l'exercice {fyLabel(fyStartYear)} pour l'instant.</p>
          <p className="text-[#555] text-xs mt-1">Un client est « nouveau » si son tout premier projet ou sa première facture tombe dans cet exercice.</p>
        </div>
      ) : (
        <>
          {/* Point 5 — Cadence des entrées (nouveaux clients par mois) */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <BarChart3 size={16} className="text-[#8b5cf6]" />
              <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Cadence des entrées</h3>
              <span className="text-[11px] text-[#666]">nouveaux clients par mois · exercice {fyLabel(fyStartYear)}</span>
            </div>
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {cadence.map(m => (
                <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                  <span className="text-[10px] font-bold text-white h-3">{m.n > 0 ? m.n : ''}</span>
                  <div className="w-full rounded-t transition-all" style={{ height: `${Math.max(3, m.n / maxN * 72)}px`, backgroundColor: m.n > 0 ? '#8b5cf6' : '#242424', outline: m.isCurrent ? '1px solid #fff6' : 'none' }} title={`${m.label} : ${m.n} nouveau(x) · ${fmtK(m.ca)}`} />
                  <span className={`text-[9px] uppercase ${m.isCurrent ? 'text-white font-bold' : 'text-[#666]'}`}>{m.label}</span>
                  <span className="text-[8px] text-[#555] h-2.5">{m.ca > 0 ? fmtK(m.ca) : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Point 2 — Santé du pipe : stades + concentration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            <div className="lg:col-span-2 bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Layers size={16} className="text-[#8b5cf6]" />
                <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Pipe par stade</h3>
                <span className="ml-auto text-xs text-[#888]">{fmtK(totals.pipe)} pondéré · {allDevis.length} devis</span>
              </div>
              {stages.length === 0 ? <p className="text-[#666] text-sm py-3">Aucun devis en cours.</p> : (
                <div className="space-y-2.5">
                  {stages.map(s => {
                    const share = totals.pipe > 0 ? Math.round(s.pond / totals.pipe * 100) : 0;
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-xs mb-1 gap-2">
                          <span className="font-semibold text-[#ddd] flex items-center gap-1.5 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stageCol(s.name) }} /><span className="truncate">{s.name}</span> <span className="text-[#666] shrink-0">· {s.n}</span></span>
                          <span className="text-[#aaa] shrink-0"><span className="font-bold text-white">{fmtK(s.pond)}</span> pond. <span className="text-[#555]">/ {fmtK(s.brut)} brut</span></span>
                        </div>
                        <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-2 rounded-full" style={{ width: `${share}%`, backgroundColor: stageCol(s.name) }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={16} className="text-[#f39c12]" />
                <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Concentration</h3>
              </div>
              <p className="text-[11px] text-[#888] mb-3">Top 3 deals = <span className="font-bold" style={{ color: top3Share >= 60 ? '#e74c3c' : '#f39c12' }}>{top3Share}%</span> du pipe pondéré{top3Share >= 60 ? ' · forte dépendance' : ''}.</p>
              <div className="space-y-1.5">
                {topDeals.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#ccc] truncate" title={`${d.client} — ${d.title}`}>{d.client}</span>
                    <span className="text-[#3b82f6] font-bold shrink-0">{fmtK(d.probabilise)}</span>
                  </div>
                ))}
                {topDeals.length === 0 && <p className="text-[#666] text-xs">Aucun deal.</p>}
              </div>
            </div>
          </div>

          {/* Point 2 — Devis à relancer (ouverts depuis longtemps) */}
          {stale.length > 0 && (
            <div className="bg-[#161616] border border-[#f39c12]/30 rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <AlertTriangle size={16} className="text-[#f39c12]" />
                <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Devis à relancer</h3>
                <span className="text-[11px] text-[#666]">ouverts depuis ≥ 45 jours · {stale.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                    <th className="text-left py-2 px-2 font-bold">Devis</th>
                    <th className="text-left py-2 px-2 font-bold">Client</th>
                    <th className="text-right py-2 px-2 font-bold">Montant</th>
                    <th className="text-right py-2 px-2 font-bold">Proba</th>
                    <th className="text-left py-2 px-2 font-bold">Stade</th>
                    <th className="text-right py-2 px-2 font-bold">Âge</th>
                  </tr></thead>
                  <tbody>
                    {stale.slice(0, 15).map(d => (
                      <tr key={d.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                        <td className="py-2 px-2 text-[#ccc] text-xs italic truncate max-w-[260px]">{d.title}</td>
                        <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[140px]">{d.client}</td>
                        <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(d.amount)}</td>
                        <td className="py-2 px-2 text-right text-xs font-bold" style={{ color: d.probability >= 70 ? '#2ecc71' : d.probability >= 40 ? '#f39c12' : '#888' }}>{d.probability}%</td>
                        <td className="py-2 px-2 text-xs text-[#888]">{d.pipe_name || '—'}</td>
                        <td className="py-2 px-2 text-right text-xs font-bold" style={{ color: d.age >= 90 ? '#e74c3c' : '#f39c12' }}>{d.age} j</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tableau des nouveaux clients */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
            <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider mb-4">
              Portefeuille des nouveaux clients ({clients.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-[#888] text-xs uppercase tracking-wide border-b border-[#2a2a2a]">
                    <th className="text-left font-semibold py-2 pr-3">Client</th>
                    <th className="text-left font-semibold py-2 px-2">Entrée</th>
                    <th className="text-right font-semibold py-2 px-2">CA signé</th>
                    <th className="text-right font-semibold py-2 px-2">MB%</th>
                    <th className="text-right font-semibold py-2 px-2">Pipe pondéré</th>
                    <th className="text-right font-semibold py-2 px-2">Projets</th>
                    <th className="text-right font-semibold py-2 pl-2">Devis</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const isSel = selected === c.name;
                    return (
                      <tr key={c.name}
                        onClick={() => setSelected(isSel ? null : c.name)}
                        className={`border-b border-[#1a1a1a] cursor-pointer transition-colors ${isSel ? 'bg-[#8b5cf6]/10' : 'hover:bg-[#1a1a1a]'}`}>
                        <td className="py-2.5 pr-3 font-semibold text-white">{c.name}</td>
                        <td className="py-2.5 px-2 text-[#888] text-xs">{formatDate(c.firstMove)}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-white">{fmtK(c.caSigne)}</td>
                        <td className="py-2.5 px-2 text-right">
                          {c.caSigne > 0
                            ? <span style={{ color: c.margePct >= 54 ? '#2ecc71' : c.margePct >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(c.margePct)}</span>
                            : <span className="text-[#555]">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#3b82f6] font-medium">{c.pipe > 0 ? fmtK(c.pipe) : '—'}</td>
                        <td className="py-2.5 px-2 text-right text-[#ccc]">{c.projects.length}</td>
                        <td className="py-2.5 pl-2 text-right text-[#ccc]">{c.devis.length}</td>
                        <td className="py-2.5 text-right">
                          <ChevronRight size={15} className={`text-[#555] transition-transform ${isSel ? 'rotate-90' : ''}`} />
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[#8b5cf6]/40 bg-[#8b5cf6]/5 font-bold">
                    <td className="py-2.5 pr-3 text-white" colSpan={2}>TOTAL ({totals.count})</td>
                    <td className="py-2.5 px-2 text-right text-white">{fmtK(totals.caSigne)}</td>
                    <td className="py-2.5 px-2 text-right text-[#888]">{fmtPct(totals.margePct || 0)}</td>
                    <td className="py-2.5 px-2 text-right text-[#3b82f6]">{fmtK(totals.pipe)}</td>
                    <td className="py-2.5 px-2 text-right text-[#ccc]">{totals.projects}</td>
                    <td className="py-2.5 pl-2 text-right text-[#ccc]">{totals.devis}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[#555] text-[11px] mt-3">
              Clients médias (deals MED0 : footpack, runpack, velopack…) sont suivis dans l'onglet <span className="text-[#8b5cf6]">Médias</span>, pas ici.
            </p>
          </div>

          {/* Détail du client sélectionné */}
          {selectedClient && (
            <div className="space-y-4">
              {selectedClient.projects.length > 0 && (
                <div className="bg-[#161616] border border-[#8b5cf6]/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase size={16} className="text-[#8b5cf6]" />
                    <h3 className="text-sm font-bold text-white">Projets — {selectedClient.name}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 bg-[#8b5cf6]/20 text-[#8b5cf6] rounded-full ml-auto">{selectedClient.projects.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                          <th className="text-left py-2 px-2 font-bold">Projet</th>
                          <th className="text-right py-2 px-2 font-bold">CA Net</th>
                          <th className="text-right py-2 px-2 font-bold">MB%</th>
                          <th className="text-left py-2 px-2 font-bold">Période</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClient.projects.map(p => (
                          <tr key={p.id} className="border-b border-[#1a1a1a]">
                            <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[280px]">{p.title}</td>
                            <td className="py-2 px-2 text-right font-bold text-white">{fmtK(p.total_amount)}</td>
                            <td className="py-2 px-2 text-right text-xs" style={{ color: p.margin >= 54 ? '#2ecc71' : p.margin >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(p.margin)}</td>
                            <td className="py-2 px-2 text-xs text-[#888]">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedClient.devis.length > 0 && (
                <div className="bg-[#161616] border border-[#3b82f6]/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-[#3b82f6]" />
                    <h3 className="text-sm font-bold text-white">Devis en cours — {selectedClient.name}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full ml-auto">{selectedClient.devis.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                          <th className="text-left py-2 px-2 font-bold">Devis</th>
                          <th className="text-right py-2 px-2 font-bold">Montant</th>
                          <th className="text-right py-2 px-2 font-bold">Proba</th>
                          <th className="text-right py-2 px-2 font-bold">Pondéré</th>
                          <th className="text-left py-2 px-2 font-bold">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClient.devis.map(d => (
                          <tr key={d.id} className="border-b border-[#1a1a1a]">
                            <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[280px]">{d.title}</td>
                            <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(d.amount)}</td>
                            <td className="py-2 px-2 text-right text-xs font-bold" style={{ color: d.probability >= 70 ? '#2ecc71' : d.probability >= 40 ? '#f39c12' : '#888' }}>{d.probability}%</td>
                            <td className="py-2 px-2 text-right font-bold text-[#3b82f6]">{fmtK(d.probabilise)}</td>
                            <td className="py-2 px-2 text-xs text-[#888]">{d.pipe_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </>)}
    </div>
  );
}
