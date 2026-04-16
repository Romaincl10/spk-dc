import { useMemo, useState } from 'react';
import { FileText, Users as UsersIcon, Map, TrendingUp, Briefcase, ClipboardList } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import ProgressBar from '../../Common/ProgressBar';
import { fmtK, fmtPct } from '../../../utils/format';
import DCSynthese from './DCSynthese';
import DCFocusClient from './DCFocusClient';
import DCRoadmap from './DCRoadmap';
import DCFocusProjet from './DCFocusProjet';
import DCFocusDevis from './DCFocusDevis';

const DC_COLORS = { 'Audrey': '#e63946', 'Hadrien': '#3b82f6', 'Ninon': '#2ecc71', 'Clément': '#f39c12', 'A assigner': '#666', 'Alizée': '#ec4899' };
const FALLBACK_COLORS = ['#e63946', '#3b82f6', '#2ecc71', '#f39c12', '#8b5cf6', '#ec4899'];
const DC_ORDER = ['Audrey', 'Hadrien', 'Ninon', 'Clément'];
function getColor(name, i) { return DC_COLORS[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]; }

const DC_SUBTABS = [
  { id: 'synthese', label: 'Synthèse', icon: FileText },
  { id: 'focus', label: 'Focus Client', icon: UsersIcon },
  { id: 'projets', label: 'Focus Projet', icon: Briefcase },
  { id: 'devis', label: 'Focus Devis', icon: ClipboardList },
  { id: 'roadmap', label: 'Roadmap', icon: Map },
];

/** Mini SVG arc gauge for table cells */
function MiniGauge({ pct, color }) {
  const p = Math.min(pct, 200);
  const arcPct = Math.min(p, 100);
  const c = color || (p >= 100 ? '#2ecc71' : p >= 60 ? '#f39c12' : '#e74c3c');
  return (
    <svg viewBox="0 0 60 36" className="w-14 h-8 inline-block">
      <path d="M 5 33 A 25 25 0 0 1 55 33" fill="none" stroke="#2a2a2a" strokeWidth="5" strokeLinecap="round" />
      <path d="M 5 33 A 25 25 0 0 1 55 33" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${arcPct * 0.785} 78.5`} />
      <text x="30" y="29" textAnchor="middle" fill="white" fontSize="10" fontWeight="800">{p}%</text>
    </svg>
  );
}

export default function AdminDashboard({ portfolios }) {
  const [selectedDC, setSelectedDC] = useState('Globale');
  const [subTab, setSubTab] = useState('synthese');
  const [viewMode, setViewMode] = useState('signe'); // 'signe' | 'projection'

  const dcNames = useMemo(() => {
    if (!portfolios) return [];
    return Object.keys(portfolios).sort((a, b) => {
      const ai = DC_ORDER.indexOf(a), bi = DC_ORDER.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1; if (bi >= 0) return 1;
      if (a === 'A assigner') return 1; if (b === 'A assigner') return -1;
      return a.localeCompare(b);
    });
  }, [portfolios]);

  const dcList = useMemo(() => {
    if (!portfolios) return [];
    return dcNames.map(name => ({ name, ...portfolios[name]?.kpis }));
  }, [portfolios, dcNames]);

  const currentPortfolio = selectedDC !== 'Globale' && portfolios ? portfolios[selectedDC] : null;
  const currentColor = getColor(selectedDC, dcNames.indexOf(selectedDC));

  const realDCs = dcList.filter(d => d.name !== 'A assigner');
  const totalCA = realDCs.reduce((s, d) => s + (d.caTotal || 0), 0);
  const totalMB = realDCs.reduce((s, d) => s + (d.mbTotal || 0), 0);
  const totalPipeProba = realDCs.reduce((s, d) => s + (d.pipelineProbabilise || 0), 0);
  const totalObj = realDCs.reduce((s, d) => s + (d.objectifTotal || 0), 0);
  const totalProjets = realDCs.reduce((s, d) => s + (d.projetsActifs || 0), 0);
  const totalClients = realDCs.reduce((s, d) => s + (d.clientsActifs || 0), 0);
  const mbPct = totalCA > 0 ? Math.round(totalMB / totalCA * 1000) / 10 : 0;
  const unassigned = dcList.find(d => d.name === 'A assigner');

  const totalProjection = totalCA + totalPipeProba;
  const objPctSigne = totalObj > 0 ? Math.round(totalCA / totalObj * 100) : 0;
  const objPctProjection = totalObj > 0 ? Math.round(totalProjection / totalObj * 100) : 0;

  const isProjection = viewMode === 'projection';

  const ViewToggle = () => (
    <div className="flex gap-1 bg-[#111] rounded-lg p-0.5">
      <button onClick={() => setViewMode('signe')}
        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'signe' ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>
        Signé
      </button>
      <button onClick={() => setViewMode('projection')}
        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'projection' ? 'bg-[#3b82f6] text-white' : 'text-[#888] hover:text-white'}`}>
        <TrendingUp size={11} /> Avec projections
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* DC Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button onClick={() => { setSelectedDC('Globale'); setSubTab('synthese'); }}
          className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors
            ${selectedDC === 'Globale' ? 'bg-[#e63946] text-white' : 'bg-[#161616] text-[#ccc] hover:text-white border border-[#2a2a2a]'}`}>
          Globale
        </button>
        {dcNames.filter(n => n !== 'A assigner').map((name, i) => (
          <button key={name} onClick={() => { setSelectedDC(name); setSubTab('synthese'); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors
              ${selectedDC === name ? 'text-white' : 'text-[#ccc] hover:text-white border border-[#2a2a2a]'}`}
            style={selectedDC === name ? { backgroundColor: getColor(name, i) } : { backgroundColor: '#161616' }}>
            {name}
          </button>
        ))}
        {unassigned && (
          <button onClick={() => { setSelectedDC('A assigner'); setSubTab('synthese'); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors
              ${selectedDC === 'A assigner' ? 'bg-[#666] text-white' : 'bg-[#161616] text-[#666] hover:text-white border border-[#333] border-dashed'}`}>
            A assigner ({unassigned.projetsTotal || 0})
          </button>
        )}
      </div>

      {/* Sub-tabs (DC detail) */}
      {selectedDC !== 'Globale' && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 bg-[#111] rounded-lg p-1 w-fit">
            {DC_SUBTABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setSubTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors
                    ${subTab === t.id ? 'bg-[#2a2a2a] text-white' : 'text-[#ccc] hover:text-white'}`}>
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>
          {(subTab === 'synthese' || subTab === 'roadmap') && <ViewToggle />}
        </div>
      )}

      {/* ═══ GLOBALE ═══ */}
      {selectedDC === 'Globale' && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Vue Globale — Exercice 2025/2026</h2>
            <ViewToggle />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KPICard label={isProjection ? 'CA + Pipeline' : 'CA Signe'} value={isProjection ? totalProjection : totalCA} suffix="€"
              subtitle={isProjection ? `dont ${fmtK(totalCA)} signés` : 'Exercice en cours'}
              color={isProjection ? 'text-[#3b82f6]' : undefined} />
            <KPICard label="Marge Brute" value={totalMB} suffix="€"
              subtitle={`MB ${fmtPct(mbPct)}`}
              color={mbPct >= 54 ? 'text-[#2ecc71]' : mbPct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
            <KPICard label="Objectifs" value={totalObj} suffix="€" />
            {isProjection && <KPICard label="Pipe Proba 30/06" value={totalPipeProba} suffix="€" color="text-[#3b82f6]" />}
            <KPICard label="Projets Actifs" value={totalProjets} />
            <KPICard label="Clients" value={totalClients} />
          </div>

          {/* DC Visual Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {realDCs.map((d, i) => {
              const color = getColor(d.name, i);
              const ca = d.caTotal || 0;
              const pipe = d.pipelineProbabilise || 0;
              const projection = ca + pipe;
              const obj = d.objectifTotal || 0;
              const pctSigne = obj > 0 ? Math.round(ca / obj * 100) : 0;
              const pctProj = obj > 0 ? Math.round(projection / obj * 100) : 0;
              const displayed = isProjection ? projection : ca;
              const pct = isProjection ? pctProj : pctSigne;
              return (
                <button key={d.name} onClick={() => { setSelectedDC(d.name); setSubTab('synthese'); }}
                  className="text-left bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 hover:border-opacity-60 transition-all"
                  style={{ borderColor: `${color}30` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold" style={{ color }}>{d.name}</span>
                    <span className="text-[10px] text-[#666]">{d.clientsActifs} clients</span>
                  </div>
                  <div className="text-2xl font-extrabold italic text-white mb-1">
                    {fmtK(displayed)}
                  </div>
                  {obj > 0 && (
                    <div className="text-xs text-[#888] mb-2">
                      {isProjection
                        ? <span>Obj: {fmtK(obj)} — <span className="text-[#3b82f6]">+{fmtK(pipe)} pipe</span></span>
                        : `Obj: ${fmtK(obj)}`}
                    </div>
                  )}
                  {obj > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-[#888]">Objectif {isProjection ? 'projeté' : 'réalisé'}</span>
                        <span className="font-bold" style={{ color: pct >= 100 ? '#2ecc71' : pct >= 60 ? '#f39c12' : '#e74c3c' }}>{pct}%</span>
                      </div>
                      <div className="w-full bg-[#2a2a2a] rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: isProjection ? '#3b82f6' : color }} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-[#666]">
                    <span>{d.projetsActifs} projets</span>
                    {viewMode === 'signe' && pipe > 0 && <span className="text-[#3b82f6]">+{fmtK(pipe)} pipe</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Comparatif table — adapts to viewMode */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider mb-4">Comparatif par DC</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left px-2 py-3 text-[10px] font-bold uppercase text-[#888]">DC</th>
                    <th className="text-left px-2 py-3 text-[10px] font-bold uppercase text-[#888]">CA Signé</th>
                    <th className="text-left px-2 py-3 text-[10px] font-bold uppercase text-[#888] w-36">Objectif + réalisé</th>
                    {isProjection && <>
                      <th className="text-left px-2 py-3 text-[10px] font-bold uppercase text-[#3b82f6]">Pipe Proba</th>
                      <th className="text-left px-2 py-3 text-[10px] font-bold uppercase text-[#888]">Projection</th>
                      <th className="text-left px-2 py-3 text-[10px] font-bold uppercase text-[#888]">Jauge Proj.</th>
                    </>}
                    <th className="text-center px-2 py-3 text-[10px] font-bold uppercase text-[#888]">Projets</th>
                    <th className="text-center px-2 py-3 text-[10px] font-bold uppercase text-[#888]">Clients</th>
                  </tr>
                </thead>
                <tbody>
                  {dcList.filter(d => d.name !== 'A assigner').map((d, i) => {
                    const projection = (d.caTotal || 0) + (d.pipelineProbabilise || 0);
                    const pctSigne = d.objectifTotal > 0 ? Math.round((d.caTotal || 0) / d.objectifTotal * 100) : 0;
                    const pctProj = d.objectifTotal > 0 ? Math.round(projection / d.objectifTotal * 100) : 0;
                    return (
                      <tr key={d.name} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] cursor-pointer"
                        onClick={() => { setSelectedDC(d.name); setSubTab('synthese'); }}>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getColor(d.name, i) }} />
                            <span className="font-bold text-white">{d.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 font-bold text-white">{fmtK(d.caTotal)}</td>
                        <td className="px-2 py-3 w-36">
                          {d.objectifTotal > 0 ? (
                            <div>
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-[#888]">{fmtK(d.objectifTotal)}</span>
                                <span className="font-bold" style={{ color: pctSigne >= 100 ? '#2ecc71' : pctSigne >= 60 ? '#f39c12' : '#e74c3c' }}>{pctSigne}%</span>
                              </div>
                              <ProgressBar value={pctSigne} max={100} />
                            </div>
                          ) : <span className="text-[#666]">—</span>}
                        </td>
                        {isProjection && <>
                          <td className="px-2 py-3 text-[#3b82f6] font-medium">{fmtK(d.pipelineProbabilise)}</td>
                          <td className="px-2 py-3 font-bold text-white">{fmtK(projection)}</td>
                          <td className="px-2 py-3">
                            {d.objectifTotal > 0
                              ? <MiniGauge pct={pctProj} color="#3b82f6" />
                              : <span className="text-[#666]">—</span>}
                          </td>
                        </>}
                        <td className="px-2 py-3 text-center text-[#ccc]">{d.projetsActifs}</td>
                        <td className="px-2 py-3 text-center text-[#ccc]">{d.clientsActifs}</td>
                      </tr>
                    );
                  })}
                  {/* TOTAL row */}
                  <tr className="border-t-2 border-[#e63946]/30 bg-[#e63946]/5 font-bold">
                    <td className="px-2 py-3 text-white">TOTAL</td>
                    <td className="px-2 py-3 text-white">{fmtK(totalCA)}</td>
                    <td className="px-2 py-3 w-36">
                      {totalObj > 0 ? (
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-[#888]">{fmtK(totalObj)}</span>
                            <span className="font-bold" style={{ color: objPctSigne >= 100 ? '#2ecc71' : '#f39c12' }}>{objPctSigne}%</span>
                          </div>
                          <ProgressBar value={objPctSigne} max={100} />
                        </div>
                      ) : '—'}
                    </td>
                    {isProjection && <>
                      <td className="px-2 py-3 text-[#3b82f6]">{fmtK(totalPipeProba)}</td>
                      <td className="px-2 py-3 text-white">{fmtK(totalProjection)}</td>
                      <td className="px-2 py-3">
                        {totalObj > 0 ? <MiniGauge pct={objPctProjection} color="#3b82f6" /> : '—'}
                      </td>
                    </>}
                    <td className="px-2 py-3 text-center text-[#ccc]">{totalProjets}</td>
                    <td className="px-2 py-3 text-center text-[#ccc]">{totalClients}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══ DC DETAIL ═══ */}
      {selectedDC !== 'Globale' && currentPortfolio && (
        <>
          {subTab === 'synthese' && <DCSynthese portfolio={currentPortfolio} color={currentColor} viewMode={viewMode} />}
          {subTab === 'focus' && <DCFocusClient portfolio={currentPortfolio} color={currentColor} />}
          {subTab === 'projets' && <DCFocusProjet portfolio={currentPortfolio} color={currentColor} />}
          {subTab === 'devis' && <DCFocusDevis portfolio={currentPortfolio} color={currentColor} />}
          {subTab === 'roadmap' && <DCRoadmap portfolio={currentPortfolio} color={currentColor} viewMode={viewMode} />}
        </>
      )}
    </div>
  );
}
