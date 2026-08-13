import { useState, useEffect, useMemo } from 'react';
import { Grid3x3 } from 'lucide-react';
import { Treemap, ResponsiveContainer } from 'recharts';
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

function HeatCell(props) {
  const { x, y, width, height, name, pctRealise, ca, objectif, fill } = props;
  if (width < 2 || height < 2) return null;
  const showTxt = width > 52 && height > 26;
  const showSub = width > 70 && height > 44;
  const nameMax = Math.floor(width / 6.5);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={2} style={{ fill: fill || '#333', stroke: '#0a0a0a', strokeWidth: 2 }} />
      {showTxt && (
        <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight="800" style={{ pointerEvents: 'none' }}>
          {name.length > nameMax ? name.slice(0, nameMax - 1) + '…' : name}
        </text>
      )}
      {showTxt && <text x={x + 6} y={y + 30} fill="rgba(255,255,255,.9)" fontSize={11} fontWeight="700" style={{ pointerEvents: 'none' }}>{pctRealise}%</text>}
      {showSub && <text x={x + 6} y={y + 44} fill="rgba(255,255,255,.7)" fontSize={9} style={{ pointerEvents: 'none' }}>{fmtK(ca)} / {fmtK(objectif)}</text>}
    </g>
  );
}

export default function HeatmapView({ fyStartYear }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dcFilter, setDcFilter] = useState('all');
  const [typoFilter, setTypoFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/api/data/heatmap?fy=${fyStartYear}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[Heatmap]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fyStartYear]);

  const pctTemps = data?.pctTemps || 0;
  const rows = useMemo(() => {
    return (data?.clients || [])
      .filter(c => (dcFilter === 'all' || c.dc === dcFilter) && (typoFilter === 'all' || c.typologie === typoFilter))
      .map(c => ({ name: c.client, objectif: c.objectif, ca: c.ca, pctRealise: c.pctRealise, dc: c.dc, typologie: c.typologie, fill: heatColor(c.pctRealise, pctTemps) }));
  }, [data, dcFilter, typoFilter, pctTemps]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" /></div>;

  const totObj = rows.reduce((s, r) => s + r.objectif, 0);
  const totCA = rows.reduce((s, r) => s + r.ca, 0);
  const totPct = totObj > 0 ? Math.round(totCA / totObj * 100) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#e63946]/15 flex items-center justify-center"><Grid3x3 size={20} className="text-[#e63946]" /></div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Heatmap objectifs clients</h2>
          <p className="text-[#888] text-sm">Taille = objectif · couleur = avancement du CA vs temps écoulé dans l'exercice (<span className="text-white font-bold">{pctTemps}%</span>)</p>
        </div>
      </div>

      {/* Filtres */}
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

      {/* Treemap */}
      {rows.length === 0 ? (
        <p className="text-[#666] text-sm text-center py-10">Aucun client sur ce filtre</p>
      ) : (
        <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-2">
          <ResponsiveContainer width="100%" height={540}>
            <Treemap data={rows} dataKey="objectif" aspectRatio={4 / 3} isAnimationActive={false} content={<HeatCell />} />
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
