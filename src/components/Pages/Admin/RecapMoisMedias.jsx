import { useState, useEffect, useMemo } from 'react';
import { CalendarRange, CheckCircle2, FileText, XCircle } from 'lucide-react';
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
              <div className="flex justify-between items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[#888] truncate">{p.client}</span>
                {kind === 'devis' && p.probability != null && <span className="text-[9px] text-[#666] shrink-0">{p.probability}% · {p.pipe_name || '—'}</span>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function RecapMoisMedias() {
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/api/data/medias-monthly-recap?month=${month}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[RecapMedias]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month]);

  const t = data?.totals || {};
  const signes = data?.signes || [], devisCrees = data?.devisCrees || [], devisPerdus = data?.devisPerdus || [];
  const hasMoves = (t.signesCount || 0) + (t.devisCreesCount || 0) + (t.devisPerdusCount || 0) > 0;

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#06b6d4]/15 flex items-center justify-center"><CalendarRange size={18} className="text-[#06b6d4]" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Récap du mois · médias</h3>
            <p className="text-[11px] text-[#888]">La température de {monthLabel(month)} : signés, devis créés, devis perdus</p>
          </div>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="bg-[#161616] border border-[#2a2a2a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4]">
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-7 h-7 border-2 border-[#06b6d4] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Tile icon={CheckCircle2} title="Projets signés" accent="#2ecc71" count={t.signesCount || 0} montant={t.signesCA || 0} montantLabel="montant" />
            <Tile icon={FileText} title="Devis créés" accent="#3b82f6" count={t.devisCreesCount || 0} montant={t.devisCreesMontant || 0} montantLabel="montant" />
            <Tile icon={XCircle} title="Devis perdus" accent="#e74c3c" count={t.devisPerdusCount || 0} montant={t.devisPerdusMontant || 0} montantLabel="perdu" />
          </div>

          {hasMoves ? (
            <div>
              <button onClick={() => setShowDetail(v => !v)}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#888] hover:text-white transition-colors">
                <span className="text-[#555]">{showDetail ? '▾' : '▸'}</span>
                {showDetail ? 'Masquer le détail des mouvements' : 'Voir le détail des mouvements (par projet / devis)'}
              </button>
              {showDetail && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 items-start">
                  <DetailColumn icon={CheckCircle2} title="Projets signés" accent="#2ecc71" items={signes} empty="Aucun projet signé" kind="projet" />
                  <DetailColumn icon={FileText} title="Devis créés" accent="#3b82f6" items={devisCrees} empty="Aucun devis créé" kind="devis" />
                  <DetailColumn icon={XCircle} title="Devis perdus" accent="#e74c3c" items={devisPerdus} empty="Aucun devis perdu" kind="perdu" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#666] text-sm text-center py-4">Aucun mouvement médias ce mois-ci.</p>
          )}
        </>
      )}
    </div>
  );
}
