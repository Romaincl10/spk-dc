import { useState, useEffect, useMemo } from 'react';
import { Grid3x3 } from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { fmtK } from '../../../utils/format';

const DC_COLORS = { 'Audrey': '#e63946', 'Hadrien': '#3b82f6', 'Ninon': '#2ecc71', 'Clément': '#f39c12', 'Naël': '#0ea5e9', 'Alizée': '#ec4899' };

// Couleur selon l'avancement du CA vs le temps écoulé dans l'exercice
function heatColor(pctR, pctT) {
  const ratio = pctT > 0 ? pctR / pctT : (pctR > 0 ? 2 : 0);
  if (ratio >= 1.3) return '#15803d';
  if (ratio >= 1.0) return '#2ecc71';
  if (ratio >= 0.7) return '#c99a2e';
  if (ratio >= 0.4) return '#d9633a';
  return '#c0392b';
}

export default function HeatmapView({ fyStartYear, onOpenClient }) {
  const [mode, setMode] = useState('agence'); // 'agence' | 'medias'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dcFilter, setDcFilter] = useState('all');
  const [typoFilter, setTypoFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    const url = mode === 'medias' ? `/api/data/medias-heatmap?fy=${fyStartYear}` : `/api/data/heatmap?fy=${fyStartYear}`;
    apiFetch(url)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[Heatmap]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fyStartYear, mode]);

  const pctTemps = data?.pctTemps || 0;
  const rows = useMemo(() => {
    return (data?.clients || [])
      .filter(c => mode === 'medias'
        ? true
        : ((dcFilter === 'all' || c.dc === dcFilter) && (typoFilter === 'all' || c.typologie === typoFilter)))
      .map(c => ({ ...c, name: c.client, fill: heatColor(c.pctRealise, pctTemps) }))
      .sort((a, b) => b.objectif - a.objectif);
  }, [data, mode, dcFilter, typoFilter, pctTemps]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" /></div>;

  const totObj = rows.reduce((s, r) => s + r.objectif, 0);
  const totCA = rows.reduce((s, r) => s + r.ca, 0);
  const totPct = totObj > 0 ? Math.round(totCA / totObj * 100) : 0;
  const accent = mode === 'medias' ? '#06b6d4' : '#e63946';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* En-tête + bascule Agences / Médias */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}26` }}><Grid3x3 size={20} style={{ color: accent }} /></div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Heatmap objectifs clients</h2>
          <p className="text-[#888] text-sm">Taille = objectif · couleur = avancement du CA vs temps écoulé (<span className="text-white font-bold">{pctTemps}%</span>)</p>
        </div>
        <div className="ml-auto flex gap-1 bg-[#111] rounded-lg p-0.5">
          <button onClick={() => setMode('agence')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'agence' ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>Agences</button>
          <button onClick={() => setMode('medias')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'medias' ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}>Médias</button>
        </div>
      </div>

      {/* Filtres — uniquement en mode Agences (DC + typologie) */}
      {mode === 'agence' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-[#111] rounded-lg p-0.5 flex-wrap">
            <button onClick={() => setDcFilter('all')} className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${dcFilter === 'all' ? 'bg-[#2a2a2a] text-white' : 'text-[#888] hover:text-white'}`}>Tous DC</button>
            {(data?.dcs || []).map(n => (
              <button key={n} onClick={() => setDcFilter(n)} className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${dcFilter === n ? 'text-white' : 'text-[#888] hover:text-white'}`}
                style={dcFilter === n ? { backgroundColor: DC_COLORS[n] || '#666' } : undefined}>{n}</button>
            ))}
          </div>
          <div className="flex gap-1 bg-[#111] rounded-lg p-0.5 flex-wrap">
            <button onClick={() => setTypoFilter('all')} className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${typoFilter === 'all' ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>Toutes typologies</button>
            {(data?.typologies || []).map(t => (
              <button key={t} onClick={() => setTypoFilter(t)} className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${typoFilter === t ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Légende couleur */}
      <div className="flex items-center gap-3 text-[11px] text-[#888] flex-wrap">
        <span className="font-bold uppercase tracking-wider text-[#666]">Avancement :</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: '#c0392b' }} /> Très en retard</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: '#d9633a' }} /> En retard</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: '#c99a2e' }} /> À surveiller</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: '#2ecc71' }} /> Dans les temps</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: '#15803d' }} /> En avance</span>
        <span className="ml-auto text-[#aaa]">{rows.length} clients · CA {fmtK(totCA)} / obj {fmtK(totObj)} · <span className="font-bold text-white">{totPct}%</span></span>
      </div>

      {/* Tuiles — taille ∝ objectif, couleur = avancement */}
      {rows.length === 0 ? (
        <p className="text-[#666] text-sm text-center py-10">Aucun client sur ce filtre</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 content-start">
          {rows.map((r, i) => {
            const grow = Math.max(1, Math.round(r.objectif / 5000));
            const badge = mode === 'medias' ? '' : `${r.typologie} · ${r.dc}`;
            return (
              <button key={i} title={`${badge ? `${r.name} · ${badge}` : r.name} — ouvrir la fiche`}
                onClick={() => onOpenClient?.({ mode, dc: r.dc, client: r.name, canonicalNames: r.canonicalNames || [] })}
                className="text-left rounded-md p-2.5 flex flex-col justify-between overflow-hidden transition-transform hover:scale-[1.03] hover:z-10 cursor-pointer"
                style={{ backgroundColor: r.fill, flexGrow: grow, flexBasis: `${Math.max(130, Math.min(320, Math.sqrt(r.objectif) * 6))}px`, minHeight: 92 }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-black italic uppercase leading-tight text-white truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>{r.name}</div>
                  {badge && <div className="text-[9px] font-bold uppercase tracking-wide text-white/70">{badge}</div>}
                </div>
                <div className="flex items-end justify-between gap-1 mt-1">
                  <span className="text-lg font-black italic text-white leading-none" style={{ textShadow: '0 1px 2px rgba(0,0,0,.4)' }}>{r.pctRealise}%</span>
                  <span className="text-[9px] font-bold text-white/80 text-right leading-tight">{fmtK(r.ca)}<br /><span className="text-white/55">/ {fmtK(r.objectif)}</span></span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
