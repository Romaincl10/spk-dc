import { useMemo, useState } from 'react';
import { Percent, TrendingDown, AlertTriangle, Target } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import { fmtK, fmtPct } from '../../../utils/format';

// Seuils de marge SPK : >= 54% bon, 45-54% à surveiller, < 45% faible (fallback sans objectif)
const TARGET = 54;
const mbColor = (pct) => (pct >= 54 ? '#2ecc71' : pct >= 45 ? '#f39c12' : '#e74c3c');
// Couleur vs objectif du client : au-dessus = vert, jusqu'à 5 pts en dessous = orange, sinon rouge
const vsColor = (pct, target) => (pct >= target ? '#2ecc71' : pct >= target - 5 ? '#f39c12' : '#e74c3c');
// Barre de MB% avec repère sur l'OBJECTIF MB du client (ligne blanche). Couleur selon l'écart.
function MbBar({ pct, target }) {
  const scale = Math.max(70, target + 8);
  const w = Math.max(0, Math.min(100, (pct / scale) * 100));
  const mark = Math.max(0, Math.min(100, (target / scale) * 100));
  return (
    <div className="relative h-2 bg-[#2a2a2a] rounded-full overflow-hidden" title={`MB ${fmtPct(pct)} · objectif ${fmtPct(target)}`}>
      <div className="h-2 rounded-full" style={{ width: `${w}%`, backgroundColor: vsColor(pct, target) }} />
      <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: `${mark}%` }} />
    </div>
  );
}

export default function DCMarge({ portfolio, color }) {
  const [sort, setSort] = useState('mb'); // 'mb' = contribution | 'pct' = marges faibles d'abord
  const kpis = portfolio.kpis || {};
  const breakdown = (portfolio.clientBreakdown || []).filter(c => (c.ca || 0) > 0);

  const caTotal = kpis.caTotal != null ? kpis.caTotal : breakdown.reduce((s, c) => s + (c.ca || 0), 0);
  const mbTotal = kpis.mbTotal != null ? kpis.mbTotal : breakdown.reduce((s, c) => s + (c.mb || 0), 0);
  const mbPct = caTotal > 0 ? Math.round(mbTotal / caTotal * 1000) / 10 : 0;

  // Objectif MB du portefeuille (somme des mbTarget / somme des cibles, objectifs nominatifs)
  const obj = useMemo(() => {
    let t = 0, mb = 0;
    (portfolio.objectives || []).forEach(o => {
      if (o.client === '_BIZ_DEV' || !(o.target > 0) || !(o.mbTarget > 0)) return;
      t += o.target; mb += o.mbTarget;
    });
    return { target: t, mbTarget: mb, pct: t > 0 ? Math.round(mb / t * 1000) / 10 : 0 };
  }, [portfolio.objectives]);

  // Objectif MB% par client (mbTarget/target via noms canoniques)
  const objByClient = useMemo(() => {
    const m = {};
    (portfolio.objectives || []).forEach(o => {
      if (o.client === '_BIZ_DEV' || !(o.target > 0) || !(o.mbTarget > 0)) return;
      const names = o.canonicalNames?.length ? o.canonicalNames : [o.client];
      const pct = Math.round(o.mbTarget / o.target * 1000) / 10;
      names.forEach(n => { m[n] = pct; });
    });
    return m;
  }, [portfolio.objectives]);

  const rows = useMemo(() => {
    const list = breakdown.map(c => {
      const pct = (c.ca || 0) > 0 ? Math.round((c.mb || 0) / c.ca * 1000) / 10 : 0;
      const objPct = objByClient[c.name] ?? null;         // objectif MB% nominatif du client
      const target = objPct != null ? objPct : TARGET;    // sinon fallback seuil SPK 54%
      const delta = Math.round((pct - target) * 10) / 10; // écart vs objectif, en points
      return {
        name: c.name, ca: c.ca || 0, mb: c.mb || 0, pct, objPct, target, delta,
        hasObj: objPct != null,
        part: mbTotal > 0 ? Math.round((c.mb || 0) / mbTotal * 100) : 0,
      };
    });
    if (sort === 'ecart') list.sort((a, b) => a.delta - b.delta); // plus gros retard vs objectif d'abord
    else list.sort((a, b) => b.mb - a.mb);
    return list;
  }, [breakdown, sort, mbTotal, objByClient]);

  // Projets à faible marge (CA significatif) — à surveiller
  const lowProjects = useMemo(() => {
    const all = [];
    breakdown.forEach(c => (c.projects || []).forEach(p => {
      if ((p.total_amount || 0) < 1000) return; // ignore placeholders
      all.push({ id: p.id, title: p.title, client: c.name, ca: p.total_amount || 0, marginEur: p.marginEur || 0, margin: p.margin || 0 });
    }));
    return all.sort((a, b) => a.margin - b.margin).slice(0, 10);
  }, [breakdown]);

  // Répartition par palier de marge
  const buckets = useMemo(() => {
    const b = { bon: { n: 0, mb: 0 }, moyen: { n: 0, mb: 0 }, faible: { n: 0, mb: 0 } };
    rows.forEach(r => { const k = r.pct >= 54 ? 'bon' : r.pct >= 45 ? 'moyen' : 'faible'; b[k].n++; b[k].mb += r.mb; });
    return b;
  }, [rows]);

  const gap = obj.pct > 0 ? Math.round((mbPct - obj.pct) * 10) / 10 : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}1f` }}><Percent size={20} style={{ color }} /></div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Analyse marge brute du portefeuille</h2>
          <p className="text-[#888] text-sm">MB réalisée par client, objectif de marge et projets à surveiller</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="CA signé" value={caTotal} suffix="€" />
        <KPICard label="Marge brute" value={mbTotal} suffix="€" subtitle={`${rows.length} clients`} />
        <KPICard label="MB %" value={mbPct} suffix="%" color={mbPct >= 54 ? 'text-[#2ecc71]' : mbPct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'}
          subtitle={obj.pct > 0 ? `objectif ${fmtPct(obj.pct)}` : 'objectif SPK 54%'} />
        <KPICard label="Écart vs objectif" value={gap != null ? gap : (mbPct - TARGET)} suffix=" pts"
          color={(gap != null ? gap : mbPct - TARGET) >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}
          subtitle={gap != null ? `vs ${fmtPct(obj.pct)}` : `vs ${TARGET}%`} />
      </div>

      {/* Répartition par palier */}
      <div className="grid grid-cols-3 gap-3">
        {[['bon', 'Bonne marge (≥ 54%)', '#2ecc71'], ['moyen', 'À surveiller (45-54%)', '#f39c12'], ['faible', 'Marge faible (< 45%)', '#e74c3c']].map(([k, lbl, col]) => (
          <div key={k} className="bg-[#161616] border rounded-xl p-4" style={{ borderColor: `${col}33` }}>
            <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: col }}>{lbl}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black italic text-white">{buckets[k].n}</span>
              <span className="text-xs text-[#888]">clients · {fmtK(buckets[k].mb)} de MB</span>
            </div>
          </div>
        ))}
      </div>

      {/* MB par client */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Target size={16} style={{ color }} />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Marge brute par client</h3>
          <div className="ml-auto flex gap-1 bg-[#111] rounded-lg p-0.5">
            <button onClick={() => setSort('mb')} className={`px-2.5 py-1 text-[10px] font-bold rounded ${sort === 'mb' ? 'bg-[#2a2a2a] text-white' : 'text-[#888] hover:text-white'}`}>Contribution MB</button>
            <button onClick={() => setSort('ecart')} className={`px-2.5 py-1 text-[10px] font-bold rounded ${sort === 'ecart' ? 'bg-[#2a2a2a] text-white' : 'text-[#888] hover:text-white'}`}>Sous objectif</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                <th className="text-left py-2 px-2 font-bold">Client</th>
                <th className="text-right py-2 px-2 font-bold">CA</th>
                <th className="text-right py-2 px-2 font-bold">MB €</th>
                <th className="text-right py-2 px-2 font-bold">MB %</th>
                <th className="text-right py-2 px-2 font-bold">Objectif MB%</th>
                <th className="text-left py-2 px-2 font-bold w-40">vs objectif MB</th>
                <th className="text-right py-2 px-2 font-bold">Écart</th>
                <th className="text-right py-2 px-2 font-bold">Part MB</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[200px]">{r.name}</td>
                  <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(r.ca)}</td>
                  <td className="py-2 px-2 text-right text-white font-semibold">{fmtK(r.mb)}</td>
                  <td className="py-2 px-2 text-right font-bold" style={{ color: mbColor(r.pct) }}>{fmtPct(r.pct)}</td>
                  <td className="py-2 px-2 text-right text-[11px]">
                    {r.hasObj ? <span className="text-[#ccc]">{fmtPct(r.objPct)}</span> : <span className="text-[#666] italic" title="Pas d'objectif MB défini — seuil SPK 54%">54% <span className="text-[8px]">(SPK)</span></span>}
                  </td>
                  <td className="py-2 px-2"><MbBar pct={r.pct} target={r.target} /></td>
                  <td className="py-2 px-2 text-right text-[11px] font-bold" style={{ color: r.delta >= 0 ? '#2ecc71' : '#e74c3c' }}>
                    {r.delta >= 0 ? '+' : ''}{fmtPct(r.delta)}
                  </td>
                  <td className="py-2 px-2 text-right text-[10px] text-[#aaa]">{r.part}%</td>
                </tr>
              ))}
              <tr className="border-t-2 bg-[#1a1a1a] font-bold" style={{ borderColor: `${color}40` }}>
                <td className="py-2 px-2 text-white">TOTAL ({rows.length})</td>
                <td className="py-2 px-2 text-right text-white">{fmtK(caTotal)}</td>
                <td className="py-2 px-2 text-right text-white">{fmtK(mbTotal)}</td>
                <td className="py-2 px-2 text-right" style={{ color: mbColor(mbPct) }}>{fmtPct(mbPct)}</td>
                <td className="py-2 px-2 text-right text-[11px] text-[#ccc]">{obj.pct > 0 ? fmtPct(obj.pct) : '—'}</td>
                <td className="py-2 px-2">{obj.pct > 0 ? <MbBar pct={mbPct} target={obj.pct} /> : null}</td>
                <td className="py-2 px-2 text-right text-[11px] font-bold" style={{ color: gap == null ? '#888' : gap >= 0 ? '#2ecc71' : '#e74c3c' }}>
                  {gap == null ? '—' : `${gap >= 0 ? '+' : ''}${fmtPct(gap)}`}
                </td>
                <td className="py-2 px-2 text-right text-[10px] text-[#aaa]">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Projets à faible marge */}
      {lowProjects.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={16} className="text-[#e74c3c]" />
            <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Projets à plus faible marge</h3>
            <span className="text-[10px] text-[#666]">à surveiller / renégocier</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                  <th className="text-left py-2 px-2 font-bold">Projet</th>
                  <th className="text-left py-2 px-2 font-bold">Client</th>
                  <th className="text-right py-2 px-2 font-bold">CA</th>
                  <th className="text-right py-2 px-2 font-bold">MB €</th>
                  <th className="text-right py-2 px-2 font-bold">MB %</th>
                </tr>
              </thead>
              <tbody>
                {lowProjects.map(p => (
                  <tr key={p.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                    <td className="py-2 px-2 text-white text-xs truncate max-w-[300px]">{p.title}</td>
                    <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[140px]">{p.client}</td>
                    <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(p.ca)}</td>
                    <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(p.marginEur)}</td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color: mbColor(p.margin) }}>{fmtPct(p.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[#555] mt-2 flex items-center gap-1"><AlertTriangle size={11} /> Projets ≥ 1 k€ de CA, triés par marge croissante.</p>
        </div>
      )}
    </div>
  );
}
