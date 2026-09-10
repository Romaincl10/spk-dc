import { useState, useEffect, useMemo } from 'react';
import { CalendarRange, CheckCircle2, FileText, XCircle, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { fmtK } from '../../../utils/format';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS_FR[+m - 1]} ${y}`; };

function recentMonths() {
  const now = new Date();
  const out = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function Tile({ icon: Icon, title, accent, count, montant, montantLabel }) {
  return (
    <div className="bg-[#161616] border rounded-xl p-4" style={{ borderColor: `${accent}33` }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color: accent }} />
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: accent }}>{title}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-black italic text-white leading-none">{count}</span>
        <span className="text-sm font-bold text-[#aaa]">{fmtK(montant)}<span className="text-[10px] text-[#666] ml-1">{montantLabel}</span></span>
      </div>
    </div>
  );
}

function DcBadges({ dcs }) {
  return (
    <span className="flex gap-1 shrink-0">
      {(dcs || []).map(dc => (
        <span key={dc} className="text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-[#2a2a2a] text-[#999]">
          {dc === 'A assigner' ? 'À assigner' : dc}
        </span>
      ))}
    </span>
  );
}

// Colonne de détail : liste des mouvements (projet/devis) derrière un chiffre
function DetailColumn({ icon: Icon, title, accent, items, empty, kind }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg overflow-hidden flex flex-col">
      <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${accent}33` }}>
        <Icon size={14} style={{ color: accent }} />
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: accent }}>{title}</span>
        <span className="ml-auto text-[11px] font-bold text-[#888]">{items.length}</span>
      </div>
      <div className="p-2 space-y-1.5 max-h-[420px] overflow-y-auto">
        {items.length === 0
          ? <p className="text-[#555] text-xs text-center py-6">{empty}</p>
          : items.map(p => (
            <div key={p.id} className={`bg-[#161616] border border-[#1e1e1e] rounded-md px-3 py-2 ${kind === 'perdu' ? 'opacity-80' : ''}`}>
              <div className="flex justify-between items-baseline gap-2">
                <span className={`text-xs font-semibold text-white truncate ${kind === 'perdu' ? 'line-through decoration-[#e74c3c]/40' : ''} ${kind === 'devis' ? 'italic' : ''}`}>{p.title}</span>
                <span className="text-xs font-bold shrink-0" style={{ color: accent }}>{fmtK(p.amount)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 mt-1">
                <span className="text-[10px] text-[#888] truncate">{p.client}</span>
                <DcBadges dcs={p.dcs} />
              </div>
              {kind === 'devis' && p.probability != null && (
                <div className="text-[9px] text-[#666] mt-0.5">{p.probability}% · {p.pipe_name || '—'}</div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

export default function RecapMoisGlobal() {
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/api/data/monthly-recap?month=${month}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[RecapGlobal]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month]);

  const byDC = data?.byDC || {};
  // Agrégat agence : dédoublonnage par id (un projet/devis peut être co-géré par plusieurs DC),
  // en conservant le(s) DC concerné(s) sur chaque ligne pour le détail.
  const agg = useMemo(() => {
    const dedupe = (key) => {
      const seen = new Map();
      Object.entries(byDC).forEach(([dc, b]) => (b[key] || []).forEach(x => {
        if (!seen.has(x.id)) seen.set(x.id, { ...x, dcs: [dc] });
        else if (!seen.get(x.id).dcs.includes(dc)) seen.get(x.id).dcs.push(dc);
      }));
      return [...seen.values()].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    };
    const signes = dedupe('signes'), devisCrees = dedupe('devisCrees'), devisPerdus = dedupe('devisPerdus');
    const sum = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);
    return {
      signes, devisCrees, devisPerdus,
      signesCount: signes.length, signesCA: sum(signes),
      devisCreesCount: devisCrees.length, devisCreesMontant: sum(devisCrees),
      devisPerdusCount: devisPerdus.length, devisPerdusMontant: sum(devisPerdus),
    };
  }, [byDC]);

  // Ligne par DC (hors "A assigner" en fin), triées par CA signé décroissant
  const rows = useMemo(() => {
    return Object.entries(byDC)
      .map(([dc, b]) => ({ dc, ...(b.totals || {}) }))
      .filter(r => (r.signesCount || 0) + (r.devisCreesCount || 0) + (r.devisPerdusCount || 0) > 0)
      .sort((a, b) => {
        const aa = a.dc === 'A assigner' ? 1 : 0, bb = b.dc === 'A assigner' ? 1 : 0;
        if (aa !== bb) return aa - bb;
        return (b.signesCA || 0) - (a.signesCA || 0);
      });
  }, [byDC]);

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-5 space-y-4">
      {/* En-tête + sélecteur de mois */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#2ecc71]/15 flex items-center justify-center"><CalendarRange size={18} className="text-[#2ecc71]" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Récap du mois · toute l'agence</h3>
            <p className="text-[11px] text-[#888]">La température de {monthLabel(month)} : signés, devis créés, devis perdus</p>
          </div>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="bg-[#161616] border border-[#2a2a2a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#2ecc71]">
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-7 h-7 border-2 border-[#2ecc71] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Synthèse agence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Tile icon={CheckCircle2} title="Projets signés" accent="#2ecc71" count={agg.signesCount} montant={agg.signesCA} montantLabel="CA net" />
            <Tile icon={FileText} title="Devis créés" accent="#3b82f6" count={agg.devisCreesCount} montant={agg.devisCreesMontant} montantLabel="montant" />
            <Tile icon={XCircle} title="Devis perdus" accent="#e74c3c" count={agg.devisPerdusCount} montant={agg.devisPerdusMontant} montantLabel="perdu" />
          </div>

          {/* Température par DC */}
          {rows.length === 0 ? (
            <p className="text-[#666] text-sm text-center py-6">Aucun mouvement ce mois-ci.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                    <th className="text-left py-2 px-2 font-bold">DC</th>
                    <th className="text-right py-2 px-2 font-bold text-[#2ecc71]">Signés</th>
                    <th className="text-right py-2 px-2 font-bold text-[#2ecc71]">CA signé</th>
                    <th className="text-right py-2 px-2 font-bold text-[#3b82f6]">Devis créés</th>
                    <th className="text-right py-2 px-2 font-bold text-[#3b82f6]">Montant</th>
                    <th className="text-right py-2 px-2 font-bold text-[#e74c3c]">Perdus</th>
                    <th className="text-right py-2 px-2 font-bold text-[#e74c3c]">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.dc} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                      <td className="py-2 px-2 font-bold text-white">{r.dc === 'A assigner' ? <span className="text-[#888] italic">À assigner</span> : r.dc}</td>
                      <td className="py-2 px-2 text-right text-white font-semibold">{r.signesCount || 0}</td>
                      <td className="py-2 px-2 text-right text-[#2ecc71] font-bold">{r.signesCA > 0 ? fmtK(r.signesCA) : '—'}</td>
                      <td className="py-2 px-2 text-right text-[#ccc]">{r.devisCreesCount || 0}</td>
                      <td className="py-2 px-2 text-right text-[#3b82f6]">{r.devisCreesMontant > 0 ? fmtK(r.devisCreesMontant) : '—'}</td>
                      <td className="py-2 px-2 text-right text-[#ccc]">{r.devisPerdusCount || 0}</td>
                      <td className="py-2 px-2 text-right text-[#e74c3c]">{r.devisPerdusMontant > 0 ? fmtK(r.devisPerdusMontant) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#2ecc71]/30 bg-[#2ecc71]/5 font-bold">
                    <td className="py-2 px-2 text-white flex items-center gap-1.5"><TrendingUp size={13} className="text-[#2ecc71]" /> TOTAL</td>
                    <td className="py-2 px-2 text-right text-white">{agg.signesCount}</td>
                    <td className="py-2 px-2 text-right text-[#2ecc71]">{fmtK(agg.signesCA)}</td>
                    <td className="py-2 px-2 text-right text-[#ccc]">{agg.devisCreesCount}</td>
                    <td className="py-2 px-2 text-right text-[#3b82f6]">{fmtK(agg.devisCreesMontant)}</td>
                    <td className="py-2 px-2 text-right text-[#ccc]">{agg.devisPerdusCount}</td>
                    <td className="py-2 px-2 text-right text-[#e74c3c]">{fmtK(agg.devisPerdusMontant)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Détail des mouvements — à quel projet/devis correspond chaque chiffre */}
          {(agg.signesCount + agg.devisCreesCount + agg.devisPerdusCount) > 0 && (
            <div>
              <button onClick={() => setShowDetail(v => !v)}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#888] hover:text-white transition-colors">
                <span className="text-[#555]">{showDetail ? '▾' : '▸'}</span>
                {showDetail ? 'Masquer le détail des mouvements' : 'Voir le détail des mouvements (par projet / devis)'}
              </button>
              {showDetail && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 items-start">
                  <DetailColumn icon={CheckCircle2} title="Projets signés" accent="#2ecc71" items={agg.signes} empty="Aucun projet signé" kind="projet" />
                  <DetailColumn icon={FileText} title="Devis créés" accent="#3b82f6" items={agg.devisCrees} empty="Aucun devis créé" kind="devis" />
                  <DetailColumn icon={XCircle} title="Devis perdus" accent="#e74c3c" items={agg.devisPerdus} empty="Aucun devis perdu" kind="perdu" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
