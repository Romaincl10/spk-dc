import { useState, useEffect } from 'react';
import { Radio, Briefcase, FileText, Target, ArrowLeft, Grid3x3, Users, TrendingUp, Layers } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import ObjectiveGauge from '../../Common/ObjectiveGauge';
import RecapMoisMedias from './RecapMoisMedias';
import HeatmapView from './HeatmapView';
import { apiFetch } from '../../../utils/api';
import { fmtK, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
const MEDIA = '#06b6d4';
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// DA dédiée par média (pack). Couleurs alignées sur le reporting CODIR.
const PACK_META = {
  footpack:   { label: 'Footpack',   sport: 'Football',   color: '#ff7a3c', emoji: '⚽' },
  runpack:    { label: 'Runpack',    sport: 'Running & trail', color: '#ff5040', emoji: '🏃' },
  velopack:   { label: 'Velopack',   sport: 'Cyclisme',   color: '#ffd23c', emoji: '🚴' },
  basketpack: { label: 'Basketpack', sport: 'Basketball', color: '#3ca0ff', emoji: '🏀' },
  padelpack:  { label: 'Padelpack',  sport: 'Padel',      color: '#5edb6f', emoji: '🎾' },
  autre:      { label: 'Autre',      sport: 'Contenus & affiliation', color: '#8a8a8a', emoji: '🎬' },
};
const packMeta = (pk) => PACK_META[pk] || PACK_META.autre;

export default function MediasView({ fyStartYear, openClient, onOpened }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('synthese'); // 'synthese' | 'clients' | 'pipe' | 'heatmap'
  const [objSort, setObjSort] = useState('ca'); // 'ca' | 'pct'
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPack, setSelectedPack] = useState(null); // drill-down : fiche détail d'un média
  const [medMode, setMedMode] = useState('projete'); // 'signe' | 'projete' (signé + pipe)

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
  const byPack = data?.byPack || [];
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

  // Listes globales (onglets Clients & Pipe) — le détail par média passe par le drill-down
  const fProjects = projects;
  const fDevis = devis;
  const fCaSigne = fProjects.reduce((s, p) => s + (p.total_amount || 0), 0);
  const fMbEur = fProjects.reduce((s, p) => s + (p.marginEur || 0), 0);
  const fMbPct = fCaSigne > 0 ? Math.round(fMbEur / fCaSigne * 1000) / 10 : 0;
  const fPipe = fDevis.reduce((s, d) => s + (d.probabilise || 0), 0);
  const fPipeBrut = fDevis.reduce((s, d) => s + (d.amount || 0), 0);

  // Récap par client (onglet Clients) — projets + devis agrégés par client canonique
  const clientsRecap = (() => {
    const by = {};
    const key = x => x.canonical_client || x.company_name || 'Inconnu';
    fProjects.forEach(p => { const c = key(p); (by[c] ||= { client: c, ca: 0, mb: 0, nProj: 0, pipe: 0, pipeBrut: 0, nDev: 0, packs: new Set() }); by[c].ca += p.total_amount || 0; by[c].mb += p.marginEur || 0; by[c].nProj++; by[c].packs.add(p.pack); });
    fDevis.forEach(d => { const c = key(d); (by[c] ||= { client: c, ca: 0, mb: 0, nProj: 0, pipe: 0, pipeBrut: 0, nDev: 0, packs: new Set() }); by[c].pipe += d.probabilise || 0; by[c].pipeBrut += d.amount || 0; by[c].nDev++; by[c].packs.add(d.pack); });
    return Object.values(by).map(c => ({ ...c, mbPct: c.ca > 0 ? Math.round(c.mb / c.ca * 1000) / 10 : 0, packs: [...c.packs].filter(Boolean) }))
      .sort((a, b) => (b.ca + b.pipe) - (a.ca + a.pipe));
  })();

  // Pipe par étape (onglet Pipe)
  const pipeByStage = (() => {
    const by = {};
    fDevis.forEach(d => { const s = d.pipe_name || 'Autre'; (by[s] ||= { name: s, n: 0, pond: 0, brut: 0 }); by[s].n++; by[s].pond += d.probabilise || 0; by[s].brut += d.amount || 0; });
    return Object.values(by).sort((a, b) => b.pond - a.pond);
  })();
  const maxPackPipe = Math.max(1, ...byPack.map(p => p.pipe));
  const maxStagePond = Math.max(1, ...pipeByStage.map(s => s.pond));

  // Détail d'un client média : projets + devis rattachés (matching par nom normalisé)
  const detail = selectedClient ? (() => {
    const sn = norm(selectedClient);
    const m = (nm) => { const n = norm(nm); return !!n && !!sn && (n === sn || n.includes(sn) || sn.includes(n)); };
    const projs = projects.filter(p => m(p.canonical_client || p.company_name)).sort((a, b) => b.total_amount - a.total_amount);
    const dvs = devis.filter(p => m(p.canonical_client || p.company_name)).sort((a, b) => b.probabilise - a.probabilise);
    const ca = projs.reduce((s, p) => s + (p.total_amount || 0), 0);
    const mb = projs.reduce((s, p) => s + (p.marginEur || 0), 0);
    const pipe = dvs.reduce((s, p) => s + (p.probabilise || 0), 0);
    const objRow = allObjectives.find(o => m(o.client));
    const target = objRow?.target || 0;
    return { name: selectedClient, projects: projs, devis: dvs, ca, mb, pipe, target, mbPct: ca > 0 ? Math.round(mb / ca * 1000) / 10 : 0 };
  })() : null;

  // Détail d'un média (drill-down pack) : KPIs + clients + projets + devis du pack
  const packDetail = selectedPack ? (() => {
    const pk = selectedPack;
    const entry = byPack.find(p => p.pack === pk) || { pack: pk, objectif: 0, caSigne: 0, caProjete: 0, mbEur: 0, margePct: 0, pipe: 0, pipeBrut: 0, projectsCount: 0, devisCount: 0, clients: 0 };
    const projs = projects.filter(p => p.pack === pk).sort((a, b) => b.total_amount - a.total_amount);
    const dvs = devis.filter(d => d.pack === pk).sort((a, b) => b.probabilise - a.probabilise);
    const by = {};
    const key = x => x.canonical_client || x.company_name || 'Inconnu';
    projs.forEach(p => { const c = key(p); (by[c] ||= { client: c, ca: 0, mb: 0, nProj: 0, pipe: 0, nDev: 0 }); by[c].ca += p.total_amount || 0; by[c].mb += p.marginEur || 0; by[c].nProj++; });
    dvs.forEach(d => { const c = key(d); (by[c] ||= { client: c, ca: 0, mb: 0, nProj: 0, pipe: 0, nDev: 0 }); by[c].pipe += d.probabilise || 0; by[c].nDev++; });
    const clients = Object.values(by).map(c => ({ ...c, mbPct: c.ca > 0 ? Math.round(c.mb / c.ca * 1000) / 10 : 0 })).sort((a, b) => (b.ca + b.pipe) - (a.ca + a.pipe));
    return { pack: pk, entry, projects: projs, devis: dvs, clients };
  })() : null;

  if (detail) return <MediaClientFiche detail={detail} pctTemps={data?.pctTemps || 0} fyStartYear={fyStartYear} onBack={() => setSelectedClient(null)} />;
  if (packDetail) return <MediaPackFiche data={packDetail} projete={medMode === 'projete'} pctTemps={data?.pctTemps || 0} fyStartYear={fyStartYear} onBack={() => setSelectedPack(null)} onOpenClient={setSelectedClient} />;

  const TABS = [
    { id: 'synthese', label: 'Synthèse', icon: Target },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'pipe', label: 'Pipe', icon: TrendingUp },
    { id: 'heatmap', label: 'Heatmap', icon: Grid3x3 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#06b6d4]/15 flex items-center justify-center">
          <Radio size={20} className="text-[#06b6d4]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Médias : footpack · runpack · velopack…</h2>
          <p className="text-[#888] text-sm">Projets &amp; devis médias (code MED0) — exercice {fyLabel(fyStartYear)}</p>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-[#111] rounded-lg p-1">
          {TABS.map(t => {
            const Ic = t.icon;
            return (
              <button key={t.id} onClick={() => setView(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${view === t.id ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}>
                <Ic size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === 'synthese' && (
        <div className="space-y-5">
          {/* KPIs globaux */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label="CA signé médias" value={totals.caSigne} suffix="€"
              subtitle={`${totals.projectsCount} projets`} color="text-[#06b6d4]" />
            <KPICard label="Marge brute" value={totals.mbEur} suffix="€" subtitle={`MB ${fmtPct(totals.margePct || 0)}`}
              color={totals.margePct >= 54 ? 'text-[#2ecc71]' : totals.margePct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
            <KPICard label="Pipe pondéré" value={totals.pipe} suffix="€"
              subtitle={`${totals.devisCount} devis · ${fmtK(totals.pipeBrut)} brut`} color="text-[#3b82f6]" />
            <KPICard label="Projets / Devis" value={totals.projectsCount} suffix={` / ${totals.devisCount}`} />
          </div>

          {/* ─── Vue par média : cartes reprises du reporting CODIR ─── */}
          {byPack.length > 0 && (() => {
            const projete = medMode === 'projete';
            const DISPLAY_ORDER = ['footpack', 'runpack', 'basketpack', 'velopack', 'padelpack'];
            const packCards = DISPLAY_ORDER.map(pk => byPack.find(p => p.pack === pk)).filter(Boolean);
            const autre = byPack.find(p => p.pack === 'autre');
            const caOf = p => projete ? p.caProjete : p.caSigne;
            const totObj = packCards.reduce((s, p) => s + (p.objectif || 0), 0);
            const totCa = packCards.reduce((s, p) => s + caOf(p), 0);
            const totCov = totObj > 0 ? Math.round(totCa / totObj * 1000) / 10 : 0;
            return (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Layers size={16} className="text-[#06b6d4]" />
                <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Vue par média</h3>
                <span className="text-xs text-[#888]">CA {projete ? 'prévi (signé + pipe)' : 'signé'} vs objectif annuel · FY {fyLabel(fyStartYear)}</span>
                <div className="flex gap-0.5 bg-[#0a0a0a] rounded-lg p-0.5 ml-auto">
                  <button onClick={() => setMedMode('signe')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${!projete ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}>Signé</button>
                  <button onClick={() => setMedMode('projete')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${projete ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}>Prévi</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {packCards.map(p => {
                  const meta = packMeta(p.pack);
                  const ca = caOf(p);
                  const cov = p.objectif > 0 ? ca / p.objectif * 100 : null;
                  const covCol = cov == null ? '#888' : cov >= 100 ? '#2ecc71' : cov >= 60 ? '#f39c12' : '#e74c3c';
                  const reste = (p.objectif || 0) - ca;
                  const totalProj = p.projectsCount + p.devisCount;
                  return (
                    <button key={p.pack} onClick={() => setSelectedPack(p.pack)}
                      className="text-left rounded-xl overflow-hidden border border-[#262626] bg-[#0d0d0d] transition-all hover:bg-[#121212] hover:border-[#3a3a3a]">
                      <div className="h-[3px]" style={{ backgroundColor: meta.color }} />
                      <div className="p-4">
                        {/* En-tête : wordmark + nb projets */}
                        <div className="flex items-baseline justify-between gap-2 mb-3">
                          <span className="text-lg font-extrabold italic lowercase text-white tracking-tight truncate">{meta.label.toLowerCase()}<span style={{ color: meta.color }}>.</span></span>
                          <span className="text-[11px] text-[#888] shrink-0">{totalProj} projets ›</span>
                        </div>
                        {/* CA prévi + objectif */}
                        <p className="text-[9px] uppercase tracking-wider text-[#777] mb-1">CA {projete ? 'prévi' : 'signé'} FY {fyLabel(fyStartYear)}</p>
                        <div className="flex items-end justify-between gap-2">
                          <span className="text-3xl font-extrabold italic leading-none" style={{ color: meta.color }}>{fmtK(ca)}</span>
                          <div className="text-right">
                            <p className="text-[9px] uppercase tracking-wider text-[#777]">Objectif</p>
                            <p className="text-base font-extrabold italic text-white leading-tight">{fmtK(p.objectif)}</p>
                          </div>
                        </div>
                        {/* Couverture */}
                        <div className="flex items-center justify-between mt-4 mb-1.5">
                          <span className="text-[9px] uppercase tracking-wider text-[#777]">Couverture</span>
                          <span className="text-sm font-extrabold italic" style={{ color: covCol }}>{cov != null ? fmtPct(Math.round(cov * 10) / 10) : '—'}</span>
                        </div>
                        <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
                          <div className="h-2 rounded-full" style={{ width: `${Math.min(cov || 0, 100)}%`, backgroundColor: meta.color }} />
                        </div>
                        <p className="text-[10px] text-[#888] mt-2">{reste > 0 ? `Reste ${fmtK(reste)}` : <span className="text-[#2ecc71] font-bold">Objectif atteint</span>}</p>
                        {/* Stats bas de carte */}
                        <div className="grid grid-cols-3 gap-1 mt-4 pt-3 border-t border-[#222]">
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-[#777] mb-0.5">Taux MB</p>
                            <p className="text-sm font-extrabold italic" style={{ color: meta.color }}>{fmtPct(p.margePct)}</p>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-[#777] mb-0.5">Clients</p>
                            <p className="text-sm font-extrabold italic text-white">{p.clients}</p>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-wider text-[#777] mb-0.5">Dont signés</p>
                            <p className="text-sm font-extrabold italic text-white">{p.projectsCount}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Autre (contenus & affiliation) + bandeau cumul packs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                {autre && (
                  <button onClick={() => setSelectedPack('autre')} className="text-left rounded-xl border border-[#262626] bg-[#0d0d0d] overflow-hidden transition-all hover:border-[#3a3a3a] hover:bg-[#121212]">
                    <div className="h-[3px] bg-[#8a8a8a]" />
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold italic text-[#ccc]">autre<span className="text-[#8a8a8a]">.</span></p>
                        <p className="text-[9px] uppercase tracking-wider text-[#777]">Contenus &amp; affiliation</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-extrabold italic text-white leading-none">{fmtK(caOf(autre))}</p>
                        <p className="text-[10px] text-[#888] mt-1">{autre.projectsCount + autre.devisCount} projets · pipe {fmtK(autre.pipe)}</p>
                      </div>
                    </div>
                  </button>
                )}
                <div className={`rounded-xl border border-[#06b6d4]/30 bg-[#06b6d4]/5 p-4 flex items-center justify-between ${autre ? 'md:col-span-3' : 'md:col-span-4'}`}>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-[#777]">Cumul 5 packs — CA {projete ? 'prévi' : 'signé'}</p>
                    <p className="text-2xl font-extrabold italic text-[#06b6d4] leading-tight mt-0.5">{fmtK(totCa)} <span className="text-sm text-[#888]">/ {fmtK(totObj)}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-[#777]">Couverture objectif</p>
                    <p className="text-2xl font-extrabold italic leading-tight mt-0.5" style={{ color: totCov >= 80 ? '#2ecc71' : totCov >= 50 ? '#f39c12' : '#e74c3c' }}>{fmtPct(totCov)}</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[#666] mt-3">Cliquer un média ouvre son détail (clients, projets, devis).</p>
            </div>
            );
          })()}

          {/* Jauge objectif Médias global */}
          <ObjectiveGauge
            label={`Objectif Médias · exercice ${fyLabel(fyStartYear)}`}
            realized={totals.caSigne} target={data?.objTarget || 1200000}
            pipe={totals.pipe} pace={data?.pctTemps || 0} color="#06b6d4" />

          {/* Récap du mois — médias */}
          <RecapMoisMedias />

          {/* Objectifs CA par client (matrice commerciale médias) */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Target size={16} className="text-[#06b6d4]" />
              <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Objectifs CA par client</h3>
              <span className="text-xs text-[#888]">
                {fmtK(objCaTotal)} / {fmtK(objTargetTotal)} · <span className="font-bold" style={{ color: objPct >= 80 ? '#2ecc71' : objPct >= 50 ? '#f39c12' : '#e74c3c' }}>{objPct}%</span>
              </span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
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
        </div>
      )}

      {view === 'clients' && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Users size={16} className="text-[#06b6d4]" />
            <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Récap par client</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto" style={{ backgroundColor: `${MEDIA}20`, color: MEDIA }}>{clientsRecap.length}</span>
          </div>
          {clientsRecap.length === 0 ? (
            <p className="text-[#666] text-sm text-center py-4">Aucun client média</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                    <th className="text-left py-2 px-2 font-bold">Client</th>
                    <th className="text-left py-2 px-2 font-bold">Médias</th>
                    <th className="text-right py-2 px-2 font-bold">Projets</th>
                    <th className="text-right py-2 px-2 font-bold">CA signé</th>
                    <th className="text-right py-2 px-2 font-bold">MB%</th>
                    <th className="text-right py-2 px-2 font-bold">Devis</th>
                    <th className="text-right py-2 px-2 font-bold">Pipe pondéré</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsRecap.map(c => (
                    <tr key={c.client} onClick={() => setSelectedClient(c.client)}
                      className="border-b border-[#1a1a1a] hover:bg-[#06b6d4]/10 cursor-pointer">
                      <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[200px]">{c.client}</td>
                      <td className="py-2 px-2">
                        <span className="flex gap-1">
                          {c.packs.map(pk => <span key={pk} className="w-2 h-2 rounded-full" title={packMeta(pk).label} style={{ backgroundColor: packMeta(pk).color }} />)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-[#aaa] text-xs">{c.nProj}</td>
                      <td className="py-2 px-2 text-right font-bold text-white">{c.ca > 0 ? fmtK(c.ca) : '—'}</td>
                      <td className="py-2 px-2 text-right text-xs" style={{ color: c.mbPct >= 54 ? '#2ecc71' : c.mbPct >= 45 ? '#f39c12' : c.ca > 0 ? '#e74c3c' : '#555' }}>{c.ca > 0 ? fmtPct(c.mbPct) : '—'}</td>
                      <td className="py-2 px-2 text-right text-[#aaa] text-xs">{c.nDev || '—'}</td>
                      <td className="py-2 px-2 text-right font-bold text-[#3b82f6]">{c.pipe > 0 ? fmtK(c.pipe) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#06b6d4]/30 bg-[#06b6d4]/5 font-bold">
                    <td className="py-2 px-2 text-white text-xs" colSpan={3}>TOTAL ({clientsRecap.length})</td>
                    <td className="py-2 px-2 text-right text-white">{fmtK(fCaSigne)}</td>
                    <td className="py-2 px-2 text-right text-[#888] text-xs">{fmtPct(fMbPct)}</td>
                    <td />
                    <td className="py-2 px-2 text-right text-[#3b82f6]">{fmtK(fPipe)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-[#666] mt-3">Cliquer un client ouvre sa fiche (projets + devis détaillés).</p>
        </div>
      )}

      {view === 'pipe' && (
        <div className="space-y-5">
          {/* KPIs pipe */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KPICard label="Pipe pondéré médias" value={fPipe} suffix="€" subtitle={`${fDevis.length} devis en cours`} color="text-[#3b82f6]" />
            <KPICard label="Pipe brut" value={fPipeBrut} suffix="€" subtitle="montant total devis" />
            <KPICard label="Taux de pondération" value={fPipeBrut > 0 ? Math.round(fPipe / fPipeBrut * 100) : 0} suffix="%" subtitle="proba moyenne pondérée" />
          </div>

          {/* Pipe par média */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3"><Layers size={16} className="text-[#3b82f6]" /><h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Pipe par média</h3></div>
            <div className="space-y-2.5">
              {byPack.filter(p => p.pipe > 0 || p.devisCount > 0).map(p => {
                const meta = packMeta(p.pack);
                return (
                  <button key={p.pack} onClick={() => setSelectedPack(p.pack)}
                    className="w-full text-left rounded-lg p-2 transition-colors hover:bg-[#1c1c1c]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold uppercase tracking-tight" style={{ color: meta.color }}>{meta.emoji} {meta.label} ›</span>
                      <span className="text-[#888]"><span className="font-bold text-[#3b82f6]">{fmtK(p.pipe)}</span> · {p.devisCount} devis</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${Math.round(p.pipe / maxPackPipe * 100)}%`, backgroundColor: meta.color }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pipe par étape */}
          {pipeByStage.length > 0 && (
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3"><TrendingUp size={16} className="text-[#3b82f6]" /><h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Pipe par étape</h3></div>
              <div className="space-y-2.5">
                {pipeByStage.map(s => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#ccc] font-medium">{s.name}</span>
                      <span className="text-[#888]"><span className="font-bold text-[#3b82f6]">{fmtK(s.pond)}</span> · {s.n} devis</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-2 rounded-full bg-[#3b82f6]" style={{ width: `${Math.round(s.pond / maxStagePond * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Devis médias en cours */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-[#3b82f6]" />
              <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Devis médias en cours</h3>
              <span className="text-xs font-bold px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full ml-auto">{fDevis.length}</span>
            </div>
            {fDevis.length === 0 ? (
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
                    {fDevis.map(d => (
                      <tr key={d.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                        <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[260px]">
                          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: packMeta(d.pack).color }} title={packMeta(d.pack).label} />
                          {d.title}
                        </td>
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
                      <td className="py-2 px-2 text-white text-xs" colSpan={2}>TOTAL ({fDevis.length})</td>
                      <td className="py-2 px-2 text-right text-[#ccc] text-xs">{fmtK(fPipeBrut)}</td>
                      <td />
                      <td className="py-2 px-2 text-right text-[#3b82f6]">{fmtK(fPipe)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'heatmap' && (
        <HeatmapView fyStartYear={fyStartYear} mediaOnly onOpenClient={({ client }) => setSelectedClient(client)} />
      )}
    </div>
  );
}

// ─── Fiche détail d'un média (pack) : KPIs + clients + projets + devis ───
function MediaPackFiche({ data, projete, pctTemps, fyStartYear, onBack, onOpenClient }) {
  const { pack, entry, projects, devis, clients } = data;
  const meta = packMeta(pack);
  const ca = projete ? entry.caProjete : entry.caSigne;
  const cov = entry.objectif > 0 ? Math.round(ca / entry.objectif * 1000) / 10 : null;
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[#888] hover:text-white transition-colors p-1"><ArrowLeft size={20} /></button>
        <div className="w-1.5 h-9 rounded-full" style={{ backgroundColor: meta.color }} />
        <div>
          <h2 className="text-xl font-extrabold italic lowercase text-white leading-tight">{meta.label.toLowerCase()}<span style={{ color: meta.color }}>.</span> <span className="text-base align-middle">{meta.emoji}</span></h2>
          <p className="text-[10px] text-[#666] uppercase tracking-wider">{meta.sport} · média · exercice {fyLabel(fyStartYear)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="CA signé" value={entry.caSigne} suffix="€" subtitle={`${entry.projectsCount} projets`} color="text-[#06b6d4]" />
        <KPICard label="CA prévi" value={entry.caProjete} suffix="€" subtitle="signé + pipe" color="text-[#06b6d4]" />
        <KPICard label="Objectif" value={entry.objectif} suffix="€" subtitle={entry.objectif > 0 ? 'annuel' : 'hors objectif'} />
        <KPICard label="Couverture" value={cov != null ? cov : 0} suffix="%"
          subtitle={projete ? 'avec pipe' : 'signé'}
          color={cov == null ? 'text-[#888]' : cov >= 100 ? 'text-[#2ecc71]' : cov >= 60 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Marge brute" value={entry.mbEur} suffix="€" subtitle={`MB ${fmtPct(entry.margePct)}`}
          color={entry.margePct >= 54 ? 'text-[#2ecc71]' : entry.margePct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Pipe pondéré" value={entry.pipe} suffix="€" subtitle={`${entry.devisCount} devis`} color="text-[#3b82f6]" />
      </div>

      {entry.objectif > 0 && (
        <ObjectiveGauge label={`Objectif ${meta.label} · exercice ${fyLabel(fyStartYear)}`} realized={entry.caSigne} target={entry.objectif} pipe={entry.pipe} pace={pctTemps} color={meta.color} />
      )}

      {/* Clients du média */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3"><Users size={16} style={{ color: meta.color }} /><h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Clients {meta.label} ({clients.length})</h3></div>
        {clients.length === 0 ? <p className="text-[#666] text-sm py-3">Aucun client.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                <th className="text-left py-2 px-2 font-bold">Client</th>
                <th className="text-right py-2 px-2 font-bold">Projets</th>
                <th className="text-right py-2 px-2 font-bold">CA signé</th>
                <th className="text-right py-2 px-2 font-bold">MB%</th>
                <th className="text-right py-2 px-2 font-bold">Devis</th>
                <th className="text-right py-2 px-2 font-bold">Pipe</th>
              </tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.client} onClick={() => onOpenClient(c.client)} className="border-b border-[#1a1a1a] hover:bg-[#06b6d4]/10 cursor-pointer">
                    <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[200px]">{c.client}</td>
                    <td className="py-2 px-2 text-right text-[#aaa] text-xs">{c.nProj}</td>
                    <td className="py-2 px-2 text-right font-bold text-white">{c.ca > 0 ? fmtK(c.ca) : '—'}</td>
                    <td className="py-2 px-2 text-right text-xs" style={{ color: c.mbPct >= 54 ? '#2ecc71' : c.mbPct >= 45 ? '#f39c12' : c.ca > 0 ? '#e74c3c' : '#555' }}>{c.ca > 0 ? fmtPct(c.mbPct) : '—'}</td>
                    <td className="py-2 px-2 text-right text-[#aaa] text-xs">{c.nDev || '—'}</td>
                    <td className="py-2 px-2 text-right font-bold text-[#3b82f6]">{c.pipe > 0 ? fmtK(c.pipe) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Projets du média */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3"><Briefcase size={16} style={{ color: meta.color }} /><h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Projets {meta.label} ({projects.length})</h3></div>
        {projects.length === 0 ? <p className="text-[#666] text-sm py-3">Aucun projet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                <th className="text-left py-2 px-2 font-bold">Projet</th>
                <th className="text-left py-2 px-2 font-bold">Client</th>
                <th className="text-right py-2 px-2 font-bold">CA</th>
                <th className="text-right py-2 px-2 font-bold">MB%</th>
                <th className="text-left py-2 px-2 font-bold">Période</th>
              </tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-b border-[#1a1a1a]">
                    <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[300px]">{p.title}</td>
                    <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[150px]">{p.canonical_client || p.company_name}</td>
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

      {/* Devis du média */}
      {devis.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3"><FileText size={16} className="text-[#3b82f6]" /><h3 className="text-sm font-bold text-[#3b82f6] uppercase tracking-wider">Devis en cours ({devis.length})</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                <th className="text-left py-2 px-2 font-bold">Devis</th>
                <th className="text-left py-2 px-2 font-bold">Client</th>
                <th className="text-right py-2 px-2 font-bold">Montant</th>
                <th className="text-right py-2 px-2 font-bold">Proba</th>
                <th className="text-right py-2 px-2 font-bold">Pondéré</th>
                <th className="text-left py-2 px-2 font-bold">Statut</th>
              </tr></thead>
              <tbody>
                {devis.map(d => (
                  <tr key={d.id} className="border-b border-[#1a1a1a]">
                    <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[260px]">{d.title}</td>
                    <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[140px]">{d.canonical_client || d.company_name}</td>
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
                    <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[320px]">
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: packMeta(p.pack).color }} title={packMeta(p.pack).label} />
                      {p.title}
                    </td>
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
                    <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[280px]">
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: packMeta(d.pack).color }} title={packMeta(d.pack).label} />
                      {d.title}
                    </td>
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
