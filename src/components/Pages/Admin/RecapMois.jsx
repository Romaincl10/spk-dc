import { useState, useEffect, useMemo } from 'react';
import { CalendarRange, CheckCircle2, FileText, XCircle } from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { fmtK } from '../../../utils/format';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS_FR[+m - 1]} ${y}`; };

// 12 derniers mois (mois courant en tête)
function recentMonths() {
  const now = new Date();
  const out = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function Column({ icon: Icon, title, accent, count, montant, montantLabel, items, renderItem, empty }) {
  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
      <div className="p-4" style={{ background: `linear-gradient(160deg, ${accent}22, transparent)`, borderBottom: `1px solid ${accent}33` }}>
        <div className="flex items-center gap-2 mb-2">
          <Icon size={16} style={{ color: accent }} />
          <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: accent }}>{title}</h3>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-black italic text-white leading-none">{count}</span>
          <span className="text-sm font-bold text-[#aaa]">{fmtK(montant)}<span className="text-[10px] text-[#666] ml-1">{montantLabel}</span></span>
        </div>
      </div>
      <div className="p-2 space-y-1.5 max-h-[460px] overflow-y-auto">
        {items.length === 0
          ? <p className="text-[#555] text-xs text-center py-6">{empty}</p>
          : items.map(renderItem)}
      </div>
    </div>
  );
}

export default function RecapMois({ dc }) {
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/api/data/monthly-recap?month=${month}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[Recap]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month]);

  const b = data?.byDC?.[dc] || { signes: [], devisCrees: [], devisPerdus: [], totals: {} };
  const t = b.totals || {};

  return (
    <div className="space-y-5">
      {/* En-tête + sélecteur de mois */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2ecc71]/15 flex items-center justify-center">
            <CalendarRange size={20} className="text-[#2ecc71]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold italic text-white">Récap du mois — {dc}</h2>
            <p className="text-[#888] text-sm">Mouvements de {monthLabel(month)} : signés, devis créés, devis perdus</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#666]">Mois</span>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="bg-[#161616] border border-[#2a2a2a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#2ecc71]">
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-[#2ecc71] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          <Column icon={CheckCircle2} title="Projets signés" accent="#2ecc71"
            count={t.signesCount || 0} montant={t.signesCA || 0} montantLabel="CA net"
            items={b.signes} empty="Aucun projet signé ce mois-ci"
            renderItem={p => (
              <div key={p.id} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-md px-3 py-2">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs font-semibold text-white truncate">{p.title}</span>
                  <span className="text-xs font-bold text-[#2ecc71] shrink-0">{fmtK(p.amount)}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2 mt-0.5">
                  <span className="text-[10px] text-[#888] truncate">{p.client}</span>
                  {p.margin > 0 && <span className="text-[9px] text-[#666] shrink-0">MB {p.margin}%</span>}
                </div>
              </div>
            )} />

          <Column icon={FileText} title="Devis créés" accent="#3b82f6"
            count={t.devisCreesCount || 0} montant={t.devisCreesMontant || 0} montantLabel="montant"
            items={b.devisCrees} empty="Aucun devis créé ce mois-ci"
            renderItem={p => (
              <div key={p.id} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-md px-3 py-2">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs font-semibold text-[#cfe0ff] italic truncate">{p.title}</span>
                  <span className="text-xs font-bold text-[#3b82f6] shrink-0">{fmtK(p.amount)}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2 mt-0.5">
                  <span className="text-[10px] text-[#888] truncate">{p.client}</span>
                  <span className="text-[9px] text-[#666] shrink-0">{p.probability}% · {p.pipe_name || '—'}</span>
                </div>
              </div>
            )} />

          <Column icon={XCircle} title="Devis perdus" accent="#e74c3c"
            count={t.devisPerdusCount || 0} montant={t.devisPerdusMontant || 0} montantLabel="perdu"
            items={b.devisPerdus} empty="Aucun devis perdu ce mois-ci"
            renderItem={p => (
              <div key={p.id} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-md px-3 py-2 opacity-80">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs font-semibold text-[#ddd] truncate line-through decoration-[#e74c3c]/40">{p.title}</span>
                  <span className="text-xs font-bold text-[#e74c3c] shrink-0">{fmtK(p.amount)}</span>
                </div>
                <div className="text-[10px] text-[#888] truncate mt-0.5">{p.client}</div>
              </div>
            )} />
        </div>
      )}
    </div>
  );
}
