import { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, Radar, Target, Users, CalendarDays, Lightbulb, Check, Flame } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

const CAT_COLORS = {
  Fitness: '#a3e635', Trail: '#ff5040', Running: '#ff5040', Tennis: '#ffd23c', Padel: '#ffd23c',
  Cyclisme: '#3ca0ff', Tech: '#06b6d4', Lifestyle: '#c084fc', Football: '#2ecc71', Basket: '#ff8a3d',
  Media: '#06b6d4', Auto: '#f43f5e', Hippisme: '#d9a441', Rugby: '#818cf8',
  Distributeur: '#14b8a6', Equipementier: '#e6a23c', Institution: '#f39c12', Annonceur: '#c084fc',
};
const colorFor = (c) => CAT_COLORS[c?.cat] || '#e63946';
const TARGET_BOARD = 'BizDev'; // Plan de jeu Biz Dev (cockpit directeur)

function OppCard({ c, bucket, onIntegrated }) {
  const col = colorFor(c);
  const [busy, setBusy] = useState(null); // 'moment' | 'concept' | 'both'
  const [addedM, setAddedM] = useState(false);
  const [addedC, setAddedC] = useState(false);

  const add = async (parts, key) => {
    if (busy) return;
    setBusy(key);
    try {
      await apiFetch('/api/data/opportunites/integrate', {
        method: 'POST',
        body: JSON.stringify({ dc: bucket, id: c.id, parts, targetDc: TARGET_BOARD }),
      });
      if (!parts || parts.includes('moment')) setAddedM(true);
      if (!parts || parts.includes('concept')) setAddedC(true);
      onIntegrated && onIntegrated();
    } catch (e) { console.error('[BizDevOpp] integrate', e); }
    setBusy(null);
  };

  const hasM = c.moment && !addedM;
  const hasC = c.concept && !addedC;

  return (
    <div className="relative rounded-2xl border border-[#262626] overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(170deg,#161616 0%,#0d0d0d 65%)' }}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg,${col},${col}00)` }} />
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
            style={{ color: col, backgroundColor: `${col}1a`, border: `1px solid ${col}40` }}>{c.cat}</span>
          <div className="flex items-center gap-1.5">
            {c.hot && <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-[#e63946] bg-[#e63946]/10 border border-[#e63946]/40 flex items-center gap-0.5"><Flame size={9} /> chaud</span>}
            {c.date && <span className="text-[10px] font-bold text-[#888] bg-[#1c1c1c] px-2 py-0.5 rounded-full">{c.date}</span>}
          </div>
        </div>

        <div className="text-[19px] font-black italic text-white leading-[1.05] tracking-tight">{c.client}</div>
        {c.actu && <p className="text-[12.5px] text-[#c4c4c4] leading-snug">{c.actu}</p>}
        {c.insight && (
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: `${col}12`, border: `1px solid ${col}2e` }}>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: col }}>L'angle SPK</div>
            <p className="text-[12px] text-[#e8e8e8] leading-snug">{c.insight}</p>
          </div>
        )}

        {/* Moment (événement) */}
        {c.moment && (
          <div className={`rounded-xl bg-[#0b0b0b] border px-3 py-2 ${addedM ? 'border-[#2ecc71]/40 opacity-70' : 'border-[#232323]'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#06b6d4] flex items-center gap-1"><CalendarDays size={11} /> Événement</span>
              <span className="text-[10px] font-extrabold text-[#06b6d4]">{c.moment.date}</span>
            </div>
            <p className="text-[12.5px] font-extrabold italic text-white mt-0.5 leading-snug">{c.moment.title}</p>
          </div>
        )}

        {/* Concept */}
        {c.concept && (
          <div className={`rounded-xl bg-[#0b0b0b] border px-3 py-2 ${addedC ? 'border-[#2ecc71]/40 opacity-70' : 'border-[#232323]'}`}>
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#4F9DF7] flex items-center gap-1"><Lightbulb size={11} /> Concept</span>
            <p className="text-[13px] font-black italic text-white mt-0.5 leading-tight">{c.concept.name}</p>
            {c.concept.desc && <p className="text-[11.5px] text-[#9a9a9a] mt-0.5 leading-snug">{c.concept.desc}</p>}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {c.concept.offer && <span className="text-[10px] font-bold text-[#cfcfcf] bg-[#1a1a1a] border border-[#2c2c2c] px-2 py-0.5 rounded-lg">{c.concept.offer}</span>}
              {c.concept.budget && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg" style={{ color: col, backgroundColor: `${col}14` }}>{c.concept.budget}</span>}
            </div>
          </div>
        )}

        {/* Actions : ajouter au Plan de jeu */}
        {(hasM || hasC) ? (
          <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
            {hasM && (
              <button onClick={() => add(['moment'], 'moment')} disabled={!!busy}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#06b6d4]/12 text-[#06b6d4] border border-[#06b6d4]/35 hover:bg-[#06b6d4]/20 disabled:opacity-50 transition-colors">
                <CalendarDays size={12} /> {busy === 'moment' ? '…' : 'Événement'}
              </button>
            )}
            {hasC && (
              <button onClick={() => add(['concept'], 'concept')} disabled={!!busy}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#4F9DF7]/12 text-[#4F9DF7] border border-[#4F9DF7]/35 hover:bg-[#4F9DF7]/20 disabled:opacity-50 transition-colors">
                <Lightbulb size={12} /> {busy === 'concept' ? '…' : 'Concept'}
              </button>
            )}
            {hasM && hasC && (
              <button onClick={() => add(null, 'both')} disabled={!!busy}
                className="flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg bg-[#2ecc71] text-[#05331a] hover:brightness-110 disabled:opacity-50 transition-all">
                {busy === 'both' ? '…' : 'Les deux'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mt-auto pt-1 text-[11px] font-bold text-[#2ecc71]">
            <Check size={13} /> Ajouté au Plan de jeu
          </div>
        )}

        {c.source?.url && (
          <a href={c.source.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#7a7a7a] hover:text-[#ccc]">
            via {c.source.name} <ArrowUpRight size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function sortCards(arr) {
  return [...arr].sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0));
}

function Section({ title, subtitle, color, cards, bucket, onIntegrated }) {
  const list = sortCards(cards);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-black italic uppercase tracking-wide text-white">{title}</h3>
        <span className="text-[11px] text-[#666]">{subtitle}</span>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}1a` }}>{cards.length}</span>
      </div>
      {cards.length === 0 ? (
        <p className="text-[#666] text-sm py-6 text-center bg-[#111] border border-[#232323] rounded-xl">Aucune opportunité pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((c, i) => <OppCard key={c.id || i} c={c} bucket={bucket} onIntegrated={onIntegrated} />)}
        </div>
      )}
    </div>
  );
}

// Vue Opportunités Biz Dev (directeur) : veille datée et sourcée, scindée Prospects / Clients.
// Chaque carte permet d'ajouter l'événement et/ou le concept au Plan de jeu Biz Dev en un clic.
export default function OpportunitesBizDev() {
  const [data, setData] = useState(null);
  const [seg, setSeg] = useState('prospects');

  const load = useCallback(() => {
    apiFetch('/api/data/opportunites-bizdev')
      .then(d => setData(d))
      .catch(e => { console.error('[BizDevOpp]', e); setData({ prospects: [], clients: [] }); });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>;

  const prospects = data.prospects || [];
  const clients = data.clients || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center"><Radar size={18} className="text-[#8b5cf6]" /></div>
        <div>
          <h2 className="text-base font-black italic text-white">Opportunités : veille Biz Dev</h2>
          <p className="text-[#888] text-xs">Actus datées et sourcées (News Tank, Sport Business, veille web). Ajoute l'événement et/ou le concept au Plan de jeu en un clic.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-[#111] rounded-lg p-0.5 w-fit">
        <button onClick={() => setSeg('prospects')} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors ${seg === 'prospects' ? 'bg-[#8b5cf6] text-white' : 'text-[#888] hover:text-white'}`}>
          <Target size={13} /> Prospects <span className="opacity-70">({prospects.length})</span>
        </button>
        <button onClick={() => setSeg('clients')} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors ${seg === 'clients' ? 'bg-[#2ecc71] text-white' : 'text-[#888] hover:text-white'}`}>
          <Users size={13} /> Clients actuels <span className="opacity-70">({clients.length})</span>
        </button>
      </div>

      {seg === 'prospects' && (
        <Section title="Prospects à conquérir" subtitle="marques de la Matrice client" color="#8b5cf6" cards={prospects} bucket="BizDev-Prospects" onIntegrated={load} />
      )}
      {seg === 'clients' && (
        <Section title="Clients actuels" subtitle="rebonds et upsell sur le portefeuille" color="#2ecc71" cards={clients} bucket="BizDev-Clients" onIntegrated={load} />
      )}
    </div>
  );
}
