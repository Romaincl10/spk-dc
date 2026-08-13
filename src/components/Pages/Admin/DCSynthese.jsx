import { useMemo, useState, useRef } from 'react';
import { TrendingUp, Target, FolderOpen, FileText } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import ProgressBar from '../../Common/ProgressBar';
import { fmtK, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

/** Horizontal gauge — barre + % */
function HorizGauge({ value, max, label, color, subtitle }) {
  const hasTarget = max > 0;
  const pct = hasTarget ? Math.min(Math.round(value / max * 100), 999) : 0;
  const barPct = Math.min(pct, 100);
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#555] leading-tight pt-0.5">{label}</p>
        <span className="text-3xl font-black italic shrink-0 leading-none" style={{ color }}>{hasTarget ? `${pct > 999 ? '999+' : pct}%` : '—'}</span>
      </div>
      <div className="relative w-full h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${color}55 0%, ${color} 100%)` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color }}>{fmtK(value)}</span>
        <span className="text-[10px] text-[#555]">{subtitle || 'CA signé'} · {hasTarget ? <>obj. <span className="text-[#888] font-semibold">{fmtK(max)}</span></> : 'hors objectif'}</span>
      </div>
    </div>
  );
}

export default function DCSynthese({ portfolio, color, viewMode = 'signe', fyStartYear }) {
  const fy = fyStartYear ?? (new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  const kpis = portfolio.kpis;
  const projects = portfolio.projects || [];
  const fyProjects = projects.filter(p => p.inFY);
  const objectifsList = portfolio.objectives || [];
  const clientBreakdown = portfolio.clientBreakdown || [];
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'signe' | 'pipe'
  const detailRef = useRef(null);

  const now = new Date();

  // Objectives split — triés par CA décroissant (plus important en premier)
  const objWithTarget = objectifsList
    .filter(o => o.client !== '_BIZ_DEV' && o.target > 0)
    .sort((a, b) => (b.actual || 0) - (a.actual || 0));
  const objBizDev = objectifsList.filter(o => o.client === '_BIZ_DEV');
  // objNoTarget: clients with no target but CA, excluding those already in objWithTarget (avoid double-count)
  const objWithTargetClients = new Set(objWithTarget.map(o => o.client));
  const objNoTarget = objectifsList
    .filter(o => o.client !== '_BIZ_DEV' && !o.target && o.actual > 0 && !objWithTargetClients.has(o.client))
    .sort((a, b) => (b.actual || 0) - (a.actual || 0));

  // Marge brute par client (via les noms canoniques rattachés à chaque objectif)
  const mbByCanonical = {};
  clientBreakdown.forEach(c => { mbByCanonical[c.name] = c.mb || 0; });
  const mbForObj = (o) => {
    const names = (o.canonicalNames && o.canonicalNames.length) ? o.canonicalNames : [o.client];
    return names.reduce((s, n) => s + (mbByCanonical[n] || 0), 0);
  };
  const mbPctOf = (mb, ca) => (ca > 0 ? Math.round(mb / ca * 1000) / 10 : 0);
  const mbColor = (pct) => (pct >= 54 ? '#2ecc71' : pct >= 45 ? '#f39c12' : '#e74c3c');

  const totalObjectif = objWithTarget.reduce((s, o) => s + o.target, 0);
  const totalPipeProba = kpis.pipelineProbabilise || 0;
  // CA Signé = kpis.caTotal (source de vérité unique, cohérent avec la KPI card)
  const totalSigne = kpis.caTotal;
  const totalProjection = totalSigne + totalPipeProba;

  const bizDevData = objBizDev[0] || {};
  const bizDevCA = (bizDevData.actual || 0) + objNoTarget.reduce((s, o) => s + (o.actual || 0), 0);
  const bizDevPipe = (bizDevData.pipe || 0) + objNoTarget.reduce((s, o) => s + (o.pipe || 0), 0);

  // Grand total = clients with objectives + biz dev
  const grandTotalObjectif = totalObjectif + (bizDevData.target || 0);
  const grandTotalCA = totalSigne; // kpis.caTotal already includes everything
  const pctSigne = grandTotalObjectif > 0 ? Math.round(grandTotalCA / grandTotalObjectif * 100) : 0;
  const pctProjection = grandTotalObjectif > 0 ? Math.round(totalProjection / grandTotalObjectif * 100) : 0;
  // Clients-only % (for individual rows)
  const clientPctSigne = totalObjectif > 0 ? Math.round(totalSigne / totalObjectif * 100) : 0;

  // CA clients avec objectif uniquement (pour ligne TOTAL du tableau)
  const clientsCA = objWithTarget.reduce((s, o) => s + (o.actual || 0), 0);
  const clientsPctSigne = totalObjectif > 0 ? Math.round(clientsCA / totalObjectif * 100) : 0;

  // Pipe total pour le tableau (somme des pipes par client avec objectif)
  const totalPipeTable = objWithTarget.reduce((s, o) => s + (o.pipe || 0), 0);
  const clientsProjection = clientsCA + totalPipeTable;
  const clientsProjPct = totalObjectif > 0 ? Math.round(clientsProjection / totalObjectif * 100) : 0;

  const isProjection = viewMode === 'projection';
  const grandTotalProjectionPct = grandTotalObjectif > 0 ? Math.round(totalProjection / grandTotalObjectif * 100) : 0;
  const displayedCA = isProjection ? totalProjection : totalSigne;
  const displayedObjPct = isProjection ? pctProjection : pctSigne;

  // Click handlers: select client + scroll to detail
  const handleSelectClient = (client, type) => {
    if (selectedClient === client && selectedType === type) {
      setSelectedClient(null); setSelectedType(null);
    } else {
      setSelectedClient(client); setSelectedType(type);
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  // Noms canoniques réels rattachés au client cliqué (résout le mismatch nom d'objectif
  // court « Intersport » vs canonique projet « INTERSPORT FRANCE »).
  const canonicalNamesFor = (clientName) => {
    const obj = objectifsList.find(o => o.client === clientName && Array.isArray(o.canonicalNames) && o.canonicalNames.length);
    return obj ? obj.canonicalNames : [clientName];
  };
  // Get projects/devis for selected client
  const getProjectsForClient = (clientName) => {
    const names = canonicalNamesFor(clientName);
    return fyProjects.filter(p => names.includes(p.canonical_client || p.company_name)).sort((a, b) => b.total_amount - a.total_amount);
  };
  const getDevisForClient = (clientName) => {
    const names = canonicalNamesFor(clientName);
    const devis = [];
    names.forEach(n => { const c = clientBreakdown.find(cb => cb.name === n); if (c?.devis) devis.push(...c.devis); });
    return devis.sort((a, b) => b.probabilise - a.probabilise);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPICard
          label={isProjection ? 'CA + Pipeline' : 'CA Signe'}
          value={displayedCA} suffix="€"
          subtitle={isProjection ? `dont ${fmtK(kpis.caTotal)} signés` : `Exercice ${String(fy).slice(2)}/${String(fy + 1).slice(2)}`}
          color={isProjection ? 'text-[#3b82f6]' : undefined} />
        <KPICard label="Marge Brute" value={kpis.mbTotal} suffix="€" subtitle={`MB ${fmtPct(kpis.margeBrutePct)}`}
          color={kpis.margeBrutePct >= 54 ? 'text-[#2ecc71]' : kpis.margeBrutePct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label={`Pipe Proba 30/06/${fy + 1}`} value={kpis.pipelineProbabilise} suffix="€" color="text-[#3b82f6]" />
        <KPICard label="Projets Actifs" value={kpis.projetsActifs} />
        <KPICard label="Clients" value={kpis.clientsActifs} />
        <KPICard label={isProjection ? 'Obj. Projeté' : 'Obj. Réalisé'}
          value={displayedObjPct} suffix="%" icon={<Target size={16} />}
          color={displayedObjPct >= 80 ? 'text-[#2ecc71]' : displayedObjPct >= 50 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
      </div>

      {/* Gauge(s) + Objectifs */}
      {objectifsList.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-[#888]" />
            <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Objectifs — Exercice 01/07/{fy} au 30/06/{fy + 1}</h3>
          </div>

          {/* 3 Jauges horizontales : Clients / Biz Dev / Total */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-[#2a2a2a] mb-6">
            <HorizGauge
              value={isProjection ? clientsProjection : clientsCA}
              max={totalObjectif}
              label="CA Clients vs Objectifs"
              subtitle={isProjection ? 'Signé + pipe' : 'CA signé'}
              color={isProjection ? '#06b6d4' : '#e63946'}
            />
            <HorizGauge
              value={isProjection ? bizDevCA + bizDevPipe : bizDevCA}
              max={bizDevData.target || 0}
              label="Biz Dev vs Objectif BD"
              subtitle={isProjection ? 'Signé + pipe' : 'CA signé'}
              color={isProjection ? '#a855f7' : '#f39c12'}
            />
            <HorizGauge
              value={isProjection ? totalProjection : totalSigne}
              max={grandTotalObjectif}
              label="Total (Clients + BD)"
              subtitle={isProjection ? 'Signé + pipe' : 'CA signé'}
              color={isProjection ? '#34d399' : '#8b5cf6'}
            />
          </div>

          {/* Objectives table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase text-[#888]">Client</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase text-[#888]">Signé</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase text-[#2ecc71]">Marge brute</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase text-[#888]">Objectif CA</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase text-white bg-[#2a2a2a]/50 rounded">% réalisé (CA)</th>
                  {isProjection && <>
                    <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase text-[#3b82f6]">Pipe Proba</th>
                    <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase text-[#888]">Projection</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase text-[#888] w-28">% Projection</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {objWithTarget.map((obj, i) => {
                  const projection = (obj.actual || 0) + (obj.pipe || 0);
                  const projPct = obj.target > 0 ? Math.round(projection / obj.target * 100) : 0;
                  const isSelSigne = selectedClient === obj.client && selectedType === 'signe';
                  const isSelPipe = selectedClient === obj.client && selectedType === 'pipe';
                  return (
                    <tr key={i} className="border-b border-[#222] hover:bg-[#1c1c1c]">
                      <td className="py-3 px-3 font-semibold text-white text-sm">{obj.client}</td>
                      <td className="py-3 px-3 text-right">
                        <button onClick={() => handleSelectClient(obj.client, 'signe')}
                          className={`font-bold hover:underline transition-colors text-sm ${isSelSigne ? 'text-[#e63946]' : 'text-white'}`}>
                          {fmtK(obj.actual || 0)}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {(obj.actual || 0) > 0 ? (() => { const mb = mbForObj(obj); const pct = mbPctOf(mb, obj.actual || 0); return (
                          <span><span className="text-white font-semibold text-sm">{fmtK(mb)}</span> <span className="text-[10px] font-bold ml-0.5" style={{ color: mbColor(pct) }}>{pct}%</span></span>
                        ); })() : <span className="text-[#666]">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right text-[#aaa] text-sm">{obj.target > 0 ? fmtK(obj.target) : '—'}</td>
                      <td className="py-3 px-3 text-right bg-[#2a2a2a]/20">
                        {obj.target > 0 ? (
                          <span className="text-xl font-extrabold italic" style={{ color: obj.progress >= 80 ? '#2ecc71' : obj.progress >= 50 ? '#f39c12' : '#e74c3c' }}>
                            {obj.progress}%
                          </span>
                        ) : (obj.actual > 0 ? <span className="text-[#2ecc71] font-bold">OK</span> : '—')}
                      </td>
                      {isProjection && <>
                        <td className="py-2.5 px-3 text-right">
                          {(obj.pipe || 0) > 0 ? (
                            <button onClick={() => handleSelectClient(obj.client, 'pipe')}
                              className={`font-medium hover:underline transition-colors ${isSelPipe ? 'text-[#e63946]' : 'text-[#3b82f6]'}`}>
                              {fmtK(obj.pipe)}
                            </button>
                          ) : <span className="text-[#666]">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white font-medium">{projection > 0 ? fmtK(projection) : '—'}</td>
                        <td className="py-2.5 px-3 w-28">
                          {obj.target > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1"><ProgressBar value={projPct} max={100} color="#3b82f6" /></div>
                              <span className="text-[10px] font-bold text-[#3b82f6] w-8 text-right">{projPct}%</span>
                            </div>
                          ) : ''}
                        </td>
                      </>}
                    </tr>
                  );
                })}

                {/* TOTAL — clients avec objectif uniquement */}
                <tr className="border-t-2 border-[#e63946]/30 bg-[#e63946]/5 font-bold">
                  <td className="py-2.5 px-3 text-white">TOTAL</td>
                  <td className="py-2.5 px-3 text-right text-white">{fmtK(clientsCA)}</td>
                  <td className="py-2.5 px-3 text-right">
                    {(() => { const mb = objWithTarget.reduce((s, o) => s + mbForObj(o), 0); const pct = mbPctOf(mb, clientsCA); return <span><span className="text-white">{fmtK(mb)}</span> <span className="text-[10px] ml-0.5" style={{ color: mbColor(pct) }}>{pct}%</span></span>; })()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#ccc]">{fmtK(totalObjectif)}</td>
                  <td className="py-2.5 px-3 text-right bg-[#2a2a2a]/20">
                    <span className="text-base font-extrabold italic" style={{ color: clientsPctSigne >= 80 ? '#2ecc71' : clientsPctSigne >= 50 ? '#f39c12' : '#e74c3c' }}>{clientsPctSigne}%</span>
                  </td>
                  {isProjection && <>
                    <td className="py-2.5 px-3 text-right text-[#3b82f6]">{fmtK(totalPipeTable)}</td>
                    <td className="py-2.5 px-3 text-right text-white">{fmtK(clientsProjection)}</td>
                    <td className="py-2.5 px-3"><ProgressBar value={clientsProjPct} max={100} color="#3b82f6" /></td>
                  </>}
                </tr>

                {/* BIZ DEV */}
                {(objNoTarget.length > 0 || bizDevData.target > 0 || (bizDevData.clients || []).length > 0) && (
                  <tr><td colSpan={isProjection ? 8 : 5} className="pt-5 pb-1 px-3">
                    <span className="text-xs font-bold text-[#f39c12] uppercase tracking-wider">Business Development</span>
                    <span className="text-[10px] text-[#666] normal-case font-normal ml-2">(clients hors objectif)</span>
                  </td></tr>
                )}

                {objNoTarget.map((obj, i) => {
                  const isSelSigne = selectedClient === obj.client && selectedType === 'signe';
                  const isSelPipe = selectedClient === obj.client && selectedType === 'pipe';
                  return (
                    <tr key={`bd-${i}`} className="border-b border-[#1a1a1a] bg-[#f39c12]/5 hover:bg-[#f39c12]/10">
                      <td className="py-2.5 px-3 text-[#f39c12] font-medium">{obj.client}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => handleSelectClient(obj.client, 'signe')}
                          className={`font-bold hover:underline ${isSelSigne ? 'text-[#e63946]' : 'text-white'}`}>
                          {fmtK(obj.actual || 0)}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs">
                        {(obj.actual || 0) > 0 ? (() => { const mb = mbForObj(obj); const pct = mbPctOf(mb, obj.actual || 0); return <span><span className="text-[#ccc]">{fmtK(mb)}</span> <span className="font-bold" style={{ color: mbColor(pct) }}>{pct}%</span></span>; })() : <span className="text-[#666]">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#888]">—</td>
                      <td className="py-2.5 px-3 text-right bg-[#2a2a2a]/20"><span className="text-[#2ecc71] font-bold text-base italic">OK</span></td>
                      {isProjection && <>
                        <td className="py-2.5 px-3 text-right">
                          {(obj.pipe || 0) > 0 ? (
                            <button onClick={() => handleSelectClient(obj.client, 'pipe')}
                              className={`font-medium hover:underline ${isSelPipe ? 'text-[#e63946]' : 'text-[#3b82f6]'}`}>
                              {fmtK(obj.pipe)}
                            </button>
                          ) : <span className="text-[#666]">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white font-medium">{fmtK((obj.actual || 0) + (obj.pipe || 0))}</td>
                        <td className="py-2.5 px-3" />
                      </>}
                    </tr>
                  );
                })}

                {/* Clients BD individuels (non listés dans les objectifs) */}
                {[...(bizDevData.clients || [])].sort((a, b) => (b.actual || 0) - (a.actual || 0)).map((c, i) => {
                  const isSelSigne = selectedClient === c.client && selectedType === 'signe';
                  const isSelPipe = selectedClient === c.client && selectedType === 'pipe';
                  return (
                    <tr key={`bd-auto-${i}`} className="border-b border-[#1a1a1a] bg-[#f39c12]/5 hover:bg-[#f39c12]/10">
                      <td className="py-2.5 px-3 text-[#f39c12] font-medium">{c.client}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => handleSelectClient(c.client, 'signe')}
                          className={`font-bold hover:underline ${isSelSigne ? 'text-[#e63946]' : 'text-white'}`}>
                          {fmtK(c.actual || 0)}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs">
                        {(c.actual || 0) > 0 ? (() => { const mb = mbByCanonical[c.client] || 0; const pct = mbPctOf(mb, c.actual || 0); return <span><span className="text-[#ccc]">{fmtK(mb)}</span> <span className="font-bold" style={{ color: mbColor(pct) }}>{pct}%</span></span>; })() : <span className="text-[#666]">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#888]">—</td>
                      <td className="py-2.5 px-3 text-right bg-[#2a2a2a]/20"><span className="text-[#2ecc71] font-bold text-base italic">OK</span></td>
                      {isProjection && <>
                        <td className="py-2.5 px-3 text-right">
                          {(c.pipe || 0) > 0 ? (
                            <button onClick={() => handleSelectClient(c.client, 'pipe')}
                              className={`font-medium hover:underline ${isSelPipe ? 'text-[#e63946]' : 'text-[#3b82f6]'}`}>
                              {fmtK(c.pipe)}
                            </button>
                          ) : <span className="text-[#666]">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white font-medium">{fmtK((c.actual || 0) + (c.pipe || 0))}</td>
                        <td className="py-2.5 px-3" />
                      </>}
                    </tr>
                  );
                })}

                {(bizDevData.target > 0 || bizDevCA > 0) && (
                  <tr className="border-t border-[#f39c12]/30 bg-[#f39c12]/5 font-bold">
                    <td className="py-2.5 px-3 text-[#f39c12] italic">Total Biz Dev</td>
                    <td className="py-2.5 px-3 text-right text-white">{fmtK(bizDevCA)}</td>
                    <td className="py-2.5 px-3 text-right text-xs">
                      {(() => { const mb = (bizDevData.clients || []).reduce((s, c) => s + (mbByCanonical[c.client] || 0), 0) + objNoTarget.reduce((s, o) => s + mbForObj(o), 0); const pct = mbPctOf(mb, bizDevCA); return <span><span className="text-[#ccc]">{fmtK(mb)}</span> <span className="font-bold" style={{ color: mbColor(pct) }}>{pct}%</span></span>; })()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#ccc]">{bizDevData.target > 0 ? fmtK(bizDevData.target) : '—'}</td>
                    <td className="py-2.5 px-3 text-right bg-[#2a2a2a]/20">
                      {bizDevData.target > 0
                        ? <span className="text-base font-extrabold italic text-[#f39c12]">{Math.round(bizDevCA / bizDevData.target * 100)}%</span>
                        : <span className="text-[#2ecc71] font-bold text-base italic">OK</span>}
                    </td>
                    {isProjection && <>
                      <td className="py-2.5 px-3 text-right text-[#3b82f6]">{fmtK(bizDevPipe)}</td>
                      <td className="py-2.5 px-3 text-right text-white">{fmtK(bizDevCA + bizDevPipe)}</td>
                      <td className="py-2.5 px-3">{bizDevData.target > 0 ? <ProgressBar value={bizDevCA} max={bizDevData.target} color="#f39c12" /> : null}</td>
                    </>}
                  </tr>
                )}

              </tbody>
            </table>
          </div>


          {selectedClient && (
            <p className="text-[10px] text-[#888] mt-3">
              Cliquer à nouveau sur la valeur pour masquer le détail
            </p>
          )}
        </div>
      )}

      {/* ── Detail tables (projects or devis for selected client) ── */}
      {selectedClient && (
        <div ref={detailRef} className="space-y-4">
          {selectedType === 'signe' && (() => {
            const projs = getProjectsForClient(selectedClient);
            return (
              <div className="bg-[#161616] border border-[#e63946]/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen size={16} className="text-[#e63946]" />
                  <h3 className="text-sm font-bold text-white">Projets signés — {selectedClient}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 bg-[#e63946]/20 text-[#e63946] rounded-full ml-auto">{projs.length}</span>
                </div>
                {projs.length === 0 ? (
                  <p className="text-[#666] text-sm text-center py-4">Aucun projet trouvé</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className="text-left py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Projet</th>
                        <th className="text-right py-2 px-2 text-[10px] font-bold uppercase text-[#888]">CA Net</th>
                        <th className="text-right py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Marge</th>
                        <th className="text-right py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Avanc.</th>
                        <th className="text-left py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Période</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projs.map(p => (
                        <tr key={p.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                          <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[240px]">{p.title}</td>
                          <td className="py-2 px-2 text-right text-xs font-bold text-white">{fmtK(p.total_amount)}</td>
                          <td className="py-2 px-2 text-right text-xs font-semibold" style={{ color: p.margin >= 54 ? '#2ecc71' : p.margin >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(p.margin)}</td>
                          <td className="py-2 px-2 text-right text-xs font-bold" style={{ color: p.advancement >= 80 ? '#2ecc71' : p.advancement >= 40 ? '#f39c12' : '#e74c3c' }}>{p.advancement}%</td>
                          <td className="py-2 px-2 text-xs text-[#888]">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#e63946]/20 font-bold">
                        <td className="py-2 px-2 text-[#888] text-xs">Total ({projs.length})</td>
                        <td className="py-2 px-2 text-right text-white text-xs">{fmtK(projs.reduce((s, p) => s + p.total_amount, 0))}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            );
          })()}

          {selectedType === 'pipe' && (() => {
            const devis = getDevisForClient(selectedClient);
            return (
              <div className="bg-[#161616] border border-[#3b82f6]/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={16} className="text-[#3b82f6]" />
                  <h3 className="text-sm font-bold text-white">Devis en cours — {selectedClient}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full ml-auto">{devis.length}</span>
                </div>
                {devis.length === 0 ? (
                  <p className="text-[#666] text-sm text-center py-4">Aucun devis en cours</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className="text-left py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Devis</th>
                        <th className="text-right py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Montant</th>
                        <th className="text-right py-2 px-2 text-[10px] font-bold uppercase text-[#3b82f6]">Proba</th>
                        <th className="text-right py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Probabilisé</th>
                        <th className="text-left py-2 px-2 text-[10px] font-bold uppercase text-[#888]">Période</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devis.map(d => (
                        <tr key={d.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                          <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[240px]">{d.title}</td>
                          <td className="py-2 px-2 text-right text-xs text-[#ccc]">{fmtK(d.amount)}</td>
                          <td className="py-2 px-2 text-right text-xs font-bold text-[#3b82f6]">{d.probability}%</td>
                          <td className="py-2 px-2 text-right text-xs font-bold text-white">{fmtK(d.probabilise)}</td>
                          <td className="py-2 px-2 text-xs text-[#888]">{formatDate(d.projet_start)} → {formatDate(d.projet_stop)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#3b82f6]/20 font-bold">
                        <td className="py-2 px-2 text-[#888] text-xs">Total probabilisé</td>
                        <td className="py-2 px-2 text-right text-[#ccc] text-xs">{fmtK(devis.reduce((s, d) => s + d.amount, 0))}</td>
                        <td />
                        <td className="py-2 px-2 text-right text-white text-xs">{fmtK(devis.reduce((s, d) => s + d.probabilise, 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
