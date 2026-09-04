import { useState, useEffect } from 'react';
import { Radio, Briefcase, FileText, Target, ArrowLeft } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import ObjectiveGauge from '../../Common/ObjectiveGauge';
import { apiFetch } from '../../../utils/api';
import { fmtK, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
const MEDIA = '#06b6d4';
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function MediasView({ fyStartYear, openClient, onOpened }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [objSort, setObjSort] = useState('ca'); // 'ca' | 'pct'
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/api/data/medias?fy=${fyStartYear}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[Medias]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fyStartYear]);

  // Ouverture d'un client depuis l'extérieur (Heatmap) — one-shot : on consomme puis on vide
  useEffect(() => { if (openClient?.name) { setSelectedClient(openClient.name); onOpened?.(); } }, [openClient?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#06b6d4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const projects = data?.projects || [];
  const devis = data?.devis || [];
  const totals = data?.totals || { projectsCount: 0, caSigne: 0, mbEur: 0, devisCount: 0, pipe: 0, pipeBrut: 0, margePct: 0 };
  const objTargetTotal = data?.objTargetTotal || 0;
  const objCaTotal = data?.objCaTotal || 0;
  const objPct = objTargetTotal > 0 ? Math.round(objCaTotal / objTargetTotal * 100) : 0;
  const allObjectives = (data?.clientObjectives || []).filter(o => o.target > 0 || o.ca > 0);
  const clientObjectives = (() => {
    let list = [...allObjectives];
    if (objSort === 'pct') list.sort((a, b) => (a.pct ?? 9999) - (b.pct ?? 9999));
    else list.sort((a, b) => b.ca - a.ca);
    return list;
  })();

  // Détail d'un client média : projets + devis rattachés (matching par nom normalisé)
  const detail = selectedClient ? (() => {
    const sn = norm(selectedClient);
    const m = (nm) => { const n = norm(nm); return !!n && !!sn && (n === sn || n.includes(sn) || sn.includes(n)); };
    const projs = projects.filter(p => m(p.canonical_client || p.company_name)).sort((a, b) => b.total_amount - a.total_amount);
    const dvs = devis.filter(p => m(p.canonical_client || p.company_name)).sort((a, b) => b.probabilise - a.probabilise);
    const ca = projs.reduce((s, p) => s + (p.total_amount || 0), 0);
    const mb = projs.reduce((s, p) => s + (p.marginEur || 0), 0);
    const pipe = dvs.reduce((s, p) => s + (p.probabilise || 0), 0);
    // Objectif CA du client (matrice objectifs médias)
    const objRow = allObjectives.find(o => m(o.client));
    const target = objRow?.target || 0;
    return { name: selectedClient, projects: projs, devis: dvs, ca, mb, pipe, target, mbPct: ca > 0 ? Math.round(mb / ca * 1000) / 10 : 0 };
  })() : null;

  if (detail) return <MediaClientFiche detail={detail} pctTemps={data?.pctTemps || 0} fyStartYear={fyStartYear} onBack={() => setSelectedClient(null)} />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#06b6d4]/15 flex items-center justify-center">
          <Radio size={20} className="text-[#06b6d4]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Médias — BU footpack · runpack · velopack…</h2>
          <p className="text-[#888] text-sm">Tous les projets & devis médias (code MED0) — exercice {fyLabel(fyStartYear)}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="CA signé médias" value={totals.caSigne} suffix="€"
          subtitle={`${totals.projectsCount} projets`} color="text-[#06b6d4]" />
        <KPICard label="Marge brute" value={totals.mbEur} suffix="€" subtitle={`MB ${fmtPct(totals.margePct || 0)}`}
          color={totals.margePct >= 54 ? 'text-[#2ecc71]' : totals.margePct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Pipe pondéré" value={totals.pipe} suffix="€"
          subtitle={`${totals.devisCount} devis · ${fmtK(totals.pipeBrut)} brut`} color="text-[#3b82f6]" />
        <KPICard label="Projets / Devis" value={totals.projectsCount} suffix={` / ${totals.devisCount}`} />
      </div>

      {/* Jauge objectif Médias */}
      <ObjectiveGauge
        label={`Objectif Médias · exercice ${fyLabel(fyStartYear)}`}
        realized={totals.caSigne} target={data?.objTarget || 1200000}
        pipe={totals.pipe} pace={data?.pctTemps || 0} color="#06b6d4" />

      {/* Objectifs CA par client (matrice commerciale médias) */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Target size={16} className="text-[#06b6d4]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Objectifs CA par client</h3>
          <span className="text-xs text-[#888]">
            {fmtK(objCaTotal)} / {fmtK(objTargetTotal)} · <span className="font-bold" style={{ color: objPct >= 80 ? '#2ecc71' : objPct >= 50 ? '#f39c12' : '#e74c3c' }}>{objPct}%</span>
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Tri */}
            <select value={objSort} onChange={e => setObjSort(e.target.value)} className="bg-[#111] border border-[#2a2a2a] rounded-lg px-2 py-1 text-[10px] font-bold text-[#ccc] outline-none">
              <option value="ca">Tri : CA réalisé</option>
              <option value="pct">Tri : % réalisé (retards)</option>
            </select>
          </div>
        </div>
        {clientObjectives.length === 0 ? (
          <p className="text-[#666] text-sm text-center py-4">Aucun objectif média défini</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                  <th className="text-left py-2 px-2 font-bold w-8">#</th>
                  <th className="text-left py-2 px-2 font-bold">Client</th>
                  <th className="text-right py-2 px-2 font-bold">CA réalisé</th>
                  <th className="text-right py-2 px-2 font-bold">Objectif CA</th>
                  <th className="text-left py-2 px-2 font-bold w-40">% réalisé</th>
                </tr>
              </thead>
              <tbody>
                {clientObjectives.map(o => {
                  const pct = o.pct;
                  const barPct = Math.min(pct || 0, 100);
                  const col = pct == null ? '#888' : pct >= 100 ? '#2ecc71' : pct >= 60 ? '#f39c12' : '#e74c3c';
                  return (
                    <tr key={o.ranking} onClick={() => setSelectedClient(o.client)}
                      className="border-b border-[#1a1a1a] hover:bg-[#06b6d4]/10 cursor-pointer">
                      <td className="py-2 px-2 text-[#666] text-xs">{o.ranking}</td>
                      <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[200px]">{o.client}</td>
                      <td className="py-2 px-2 text-right font-bold text-white">{o.ca > 0 ? fmtK(o.ca) : '—'}</td>
                      <td className="py-2 px-2 text-right text-[#aaa]">{o.target > 0 ? fmtK(o.target) : '—'}</td>
                      <td className="py-2 px-2">
                        {o.target > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                              <div className="h-1.5 rounded-full" style={{ width: `${barPct}%`, backgroundColor: col }} />
                            </div>
                            <span className="text-[10px] font-bold w-9 text-right" style={{ color: col }}>{pct}%</span>
                          </div>
                        ) : (o.ca > 0 ? <span className="text-[10px] text-[#2ecc71]">hors objectif</span> : <span className="text-[#555]">—</span>)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[#06b6d4]/30 bg-[#06b6d4]/5 font-bold">
                  <td className="py-2 px-2 text-white text-xs" colSpan={2}>TOTAL ({clientObjectives.length})</td>
                  <td className="py-2 px-2 text-right text-white">{fmtK(objCaTotal)}</td>
                  <td className="py-2 px-2 text-right text-[#aaa]">{fmtK(objTargetTotal)}</td>
                  <td className="py-2 px-2 text-[10px] font-bold" style={{ color: objPct >= 80 ? '#2ecc71' : '#f39c12' }}>{objPct}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Projets médias */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase size={16} className="text-[#06b6d4]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Projets médias</h3>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto" style={{ backgroundColor: `${MEDIA}20`, color: MEDIA }}>{projects.length}</span>
        </div>
        {projects.length === 0 ? (
          <p className="text-[#666] text-sm text-center py-4">Aucun projet médias sur l'exercice</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                  <th className="text-left py-2 px-2 font-bold">Projet</th>
                  <th className="text-left py-2 px-2 font-bold">Client</th>
                  <th className="text-right py-2 px-2 font-bold">CA</th>
                  <th className="text-right py-2 px-2 font-bold">MB%</th>
                  <th className="text-left py-2 px-2 font-bold">Période</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} onClick={() => setSelectedClient(p.canonical_client || p.company_name)}
                    className="border-b border-[#1a1a1a] hover:bg-[#06b6d4]/10 cursor-pointer">
                    <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[280px]">{p.title}</td>
                    <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[150px]">{p.canonical_client || p.company_name}</td>
                    <td className="py-2 px-2 text-right font-bold text-white">{fmtK(p.total_amount)}</td>
                    <td className="py-2 px-2 text-right text-xs" style={{ color: p.margin >= 54 ? '#2ecc71' : p.margin >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(p.margin)}</td>
                    <td className="py-2 px-2 text-xs text-[#888] whitespace-nowrap">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#06b6d4]/30 bg-[#06b6d4]/5 font-bold">
                  <td className="py-2 px-2 text-white text-xs" colSpan={2}>TOTAL ({projects.length})</td>
                  <td className="py-2 px-2 text-right text-white">{fmtK(totals.caSigne)}</td>
                  <td className="py-2 px-2 text-right text-[#888] text-xs">{fmtPct(totals.margePct || 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Devis médias */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-[#3b82f6]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Devis médias en cours</h3>
          <span className="text-xs font-bold px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full ml-auto">{devis.length}</span>
        </div>
        {devis.length === 0 ? (
          <p className="text-[#666] text-sm text-center py-4">Aucun devis médias en cours</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                  <th className="text-left py-2 px-2 font-bold">Devis</th>
                  <th className="text-left py-2 px-2 font-bold">Client</th>
                  <th className="text-right py-2 px-2 font-bold">Montant</th>
                  <th className="text-right py-2 px-2 font-bold">Proba</th>
                  <th className="text-right py-2 px-2 font-bold">Pondéré</th>
                  <th className="text-left py-2 px-2 font-bold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {devis.map(d => (
                  <tr key={d.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                    <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[260px]">{d.title}</td>
                    <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[140px]">{d.canonical_client || d.company_name}</td>
                    <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(d.amount)}</td>
                    <td className="py-2 px-2 text-right text-xs font-bold" style={{ color: d.probability >= 70 ? '#2ecc71' : d.probability >= 40 ? '#f39c12' : '#888' }}>{d.probability}%</td>
                    <td className="py-2 px-2 text-right font-bold text-[#3b82f6]">{fmtK(d.probabilise)}</td>
                    <td className="py-2 px-2 text-xs text-[#888]">{d.pipe_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#3b82f6]/20 bg-[#3b82f6]/5 font-bold">
                  <td className="py-2 px-2 text-white text-xs" colSpan={2}>TOTAL ({devis.length})</td>
                  <td className="py-2 px-2 text-right text-[#ccc] text-xs">{fmtK(totals.pipeBrut)}</td>
                  <td />
                  <td className="py-2 px-2 text-right text-[#3b82f6]">{fmtK(totals.pipe)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Fiche client média : détail des projets en cours + devis ───
function MediaClientFiche({ detail, pctTemps, fyStartYear, onBack }) {
  const { name, projects, devis, ca, mb, pipe, mbPct, target } = detail;
  const actifs = projects.filter(p => p.actif === '1' || p.actif === 1);
  const objPct = target > 0 ? Math.round(ca / target * 100) : null;
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[#888] hover:text-white transition-colors p-1"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Radio size={17} className="text-[#06b6d4]" /> {name}</h2>
          <p className="text-[10px] text-[#666] uppercase tracking-wider">Fiche client médias · exercice {fyLabel(fyStartYear)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard label="CA signé médias" value={ca} suffix="€" subtitle={`${projects.length} projets`} color="text-[#06b6d4]" />
        <KPICard label="Objectif CA" value={target} suffix="€"
          subtitle={objPct != null ? `${objPct}% réalisé` : 'hors objectif'}
          color={objPct == null ? 'text-[#888]' : objPct >= 80 ? 'text-[#2ecc71]' : objPct >= 50 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Marge brute" value={mb} suffix="€" subtitle={`MB ${fmtPct(mbPct)}`}
          color={mbPct >= 54 ? 'text-[#2ecc71]' : mbPct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Pipe pondéré" value={pipe} suffix="€" subtitle={`${devis.length} devis`} color="text-[#3b82f6]" />
        <KPICard label="Projets en cours" value={actifs.length} suffix={` / ${projects.length}`} />
      </div>

      {/* Jauge objectif CA du client */}
      {target > 0 && (
        <ObjectiveGauge label={`Objectif CA médias · ${name}`} realized={ca} target={target} pipe={pipe} pace={pctTemps} color="#06b6d4" />
      )}

      {/* Projets en cours */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3"><Briefcase size={16} className="text-[#06b6d4]" /><h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Projets médias ({projects.length})</h3></div>
        {projects.length === 0 ? <p className="text-[#666] text-sm py-3">Aucun projet médias.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                <th className="text-left py-2 px-2 font-bold">Projet</th>
                <th className="text-right py-2 px-2 font-bold">CA</th>
                <th className="text-right py-2 px-2 font-bold">MB%</th>
                <th className="text-left py-2 px-2 font-bold">Période</th>
              </tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-b border-[#1a1a1a]">
                    <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[320px]">{p.title}</td>
                    <td className="py-2 px-2 text-right font-bold text-white">{fmtK(p.total_amount)}</td>
                    <td className="py-2 px-2 text-right text-xs" style={{ color: p.margin >= 54 ? '#2ecc71' : p.margin >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(p.margin)}</td>
                    <td className="py-2 px-2 text-xs text-[#888] whitespace-nowrap">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Devis médias en cours */}
      {devis.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3"><FileText size={16} className="text-[#3b82f6]" /><h3 className="text-sm font-bold text-[#3b82f6] uppercase tracking-wider">Devis en cours ({devis.length})</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                <th className="text-left py-2 px-2 font-bold">Devis</th>
                <th className="text-right py-2 px-2 font-bold">Montant</th>
                <th className="text-right py-2 px-2 font-bold">Proba</th>
                <th className="text-right py-2 px-2 font-bold">Pondéré</th>
                <th className="text-left py-2 px-2 font-bold">Statut</th>
              </tr></thead>
              <tbody>
                {devis.map(d => (
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
  );
}
