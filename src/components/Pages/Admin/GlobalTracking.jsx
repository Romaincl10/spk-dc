import { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { fmtK } from '../../../utils/format';

const DC_COLORS = { 'Audrey': '#e63946', 'Hadrien': '#3b82f6', 'Ninon': '#2ecc71', 'Clément': '#f39c12', 'Naël': '#0ea5e9', 'Alizée': '#ec4899', 'Paul': '#8b5cf6' };

export default function GlobalTracking({ portfolios }) {
  const [mode, setMode] = useState('cumul'); // cumul | agence | medias
  const [dcFilter, setDcFilter] = useState('all');

  const dcNames = useMemo(() => Object.keys(portfolios || {}).filter(n => n !== 'A assigner' && (portfolios[n]?.clientTracking || []).length).sort(), [portfolios]);

  const all = useMemo(() => {
    const out = [];
    Object.entries(portfolios || {}).forEach(([dc, p]) => {
      if (dc === 'A assigner') return;
      (p.clientTracking || []).forEach(c => out.push({ ...c, dc }));
    });
    return out;
  }, [portfolios]);

  const rows = useMemo(() => {
    return all
      .filter(c => dcFilter === 'all' || c.dc === dcFilter)
      .map(c => {
        const ca = mode === 'agence' ? c.caAgence : mode === 'medias' ? c.caMedia : c.caAgence + c.caMedia;
        const obj = mode === 'agence' ? c.objAgence : mode === 'medias' ? c.objMedia : c.objAgence + c.objMedia;
        return { client: c.client, dc: c.dc, ca, obj, pct: obj > 0 ? Math.round(ca / obj * 100) : null };
      })
      .filter(r => r.ca > 0 || r.obj > 0)
      .sort((a, b) => b.ca - a.ca);
  }, [all, mode, dcFilter]);

  const totCA = rows.reduce((s, r) => s + r.ca, 0);
  const totObj = rows.reduce((s, r) => s + r.obj, 0);
  const totPct = totObj > 0 ? Math.round(totCA / totObj * 100) : 0;

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Suivi clients — CA réalisé vs Objectif</h3>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filtre DC */}
          <div className="flex gap-1 bg-[#111] rounded-lg p-0.5 flex-wrap">
            <button onClick={() => setDcFilter('all')} className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${dcFilter === 'all' ? 'bg-[#2a2a2a] text-white' : 'text-[#888] hover:text-white'}`}>Tous DC</button>
            {dcNames.map(n => (
              <button key={n} onClick={() => setDcFilter(n)} className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${dcFilter === n ? 'text-white' : 'text-[#888] hover:text-white'}`}
                style={dcFilter === n ? { backgroundColor: DC_COLORS[n] || '#666' } : undefined}>{n}</button>
            ))}
          </div>
          {/* Filtre périmètre */}
          <div className="flex gap-1 bg-[#111] rounded-lg p-0.5">
            {[['cumul', 'Cumul'], ['agence', 'Agence'], ['medias', 'Médias']].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${mode === id ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
              <th className="text-left py-2 px-2 font-bold">Client</th>
              <th className="text-left py-2 px-2 font-bold">DC</th>
              <th className="text-right py-2 px-2 font-bold">CA réalisé</th>
              <th className="text-right py-2 px-2 font-bold">Objectif CA</th>
              <th className="text-left py-2 px-2 font-bold w-44">% réalisé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const barPct = Math.min(r.pct || 0, 100);
              const col = r.pct == null ? '#888' : r.pct >= 100 ? '#2ecc71' : r.pct >= 60 ? '#f39c12' : '#e74c3c';
              return (
                <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="py-2 px-2 text-white font-medium text-xs">{r.client}</td>
                  <td className="py-2 px-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#aaa]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DC_COLORS[r.dc] || '#666' }} />{r.dc}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-white">{fmtK(r.ca)}</td>
                  <td className="py-2 px-2 text-right text-[#aaa]">{r.obj > 0 ? fmtK(r.obj) : '—'}</td>
                  <td className="py-2 px-2">
                    {r.obj > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-1.5 rounded-full" style={{ width: `${barPct}%`, backgroundColor: col }} /></div>
                        <span className="text-[10px] font-bold w-9 text-right" style={{ color: col }}>{r.pct}%</span>
                      </div>
                    ) : (r.ca > 0 ? <span className="text-[10px] text-[#2ecc71]">hors objectif</span> : <span className="text-[#555]">—</span>)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-[#e63946]/30 bg-[#e63946]/5 font-bold">
              <td className="py-2 px-2 text-white" colSpan={2}>TOTAL {mode === 'cumul' ? '(Agence + Médias)' : mode === 'agence' ? '(Agence)' : '(Médias)'} · {rows.length} clients</td>
              <td className="py-2 px-2 text-right text-white">{fmtK(totCA)}</td>
              <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(totObj)}</td>
              <td className="py-2 px-2 text-xs font-bold" style={{ color: totPct >= 80 ? '#2ecc71' : '#f39c12' }}>{totPct}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
