import { useState, useEffect, useCallback } from 'react';
import { Radar, Dumbbell, Trophy, Newspaper, Sparkles, Check, X, ExternalLink, Sunrise } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

// Catégorie visuelle d'une carte (couleur + icône) selon la marque / l'actu.
const CATS = [
  { test: /hyrox|fitness|run|trail|marathon|crossfit/i, color: '#a3e635', Icon: Dumbbell, label: 'Fitness' },
  { test: /basket|3x3/i, color: '#ff8a3d', Icon: Trophy, label: 'Basket' },
  { test: /provence|m[ée]dia|presse|journal/i, color: '#06b6d4', Icon: Newspaper, label: 'Média' },
  { test: /foot|ligue 1|\bom\b|psg/i, color: '#22c55e', Icon: Trophy, label: 'Football' },
];
const metaFor = (c) => {
  const s = `${c.client || ''} ${c.brand || ''} ${c.actu || ''}`;
  return CATS.find(x => x.test.test(s)) || { color: '#e63946', Icon: Radar, label: 'Opportunité' };
};

// Écran « Scan du matin » : cartes visuelles d'opportunités (insight + moment + concept),
// intégrables en un clic dans le Plan de jeu du DC.
export default function Opportunites({ dc, onChanged }) {
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    if (!dc) return;
    apiFetch(`/api/data/opportunites?dc=${encodeURIComponent(dc)}`)
      .then(d => setCards(d.cards || []))
      .catch(e => { console.error('[Opp]', e); setCards([]); });
  }, [dc]);
  useEffect(() => { load(); }, [load]);

  const act = async (id, path, body) => {
    setBusy(id);
    try {
      await apiFetch(`/api/data/opportunites/${path}`, { method: 'POST', body: JSON.stringify({ dc, id, ...body }) });
      load(); onChanged?.();
    } catch (e) { console.error('[Opp] action', e); }
    setBusy(null);
  };

  if (cards === null) {
    return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête cockpit du matin */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#e63946]/25 to-[#e63946]/5 flex items-center justify-center"><Sunrise size={22} className="text-[#e63946]" /></div>
          <div>
            <h2 className="text-xl font-extrabold italic text-white">Scan du matin : {dc}</h2>
            <p className="text-[#888] text-xs">Tes opportunités à trier : intègre ce qui t'intéresse, passe le reste</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold italic leading-none" style={{ color: cards.length ? '#e63946' : '#444' }}>{cards.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#666]">à traiter</div>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-12 text-center">
          <Radar size={30} className="text-[#333] mx-auto mb-3" />
          <p className="text-[#aaa] text-sm font-medium">Tout est trié. Beau travail.</p>
          <p className="text-[#666] text-xs mt-1">Le prochain scan déposera ici les nouvelles opportunités de ton portefeuille.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {cards.map(c => {
            const m = metaFor(c); const Icon = m.Icon; const working = busy === c.id;
            return (
              <div key={c.id} className="bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden transition-colors hover:border-[#3a3a3a]">
                <div className="h-1.5" style={{ background: m.color }} />
                <div className="p-4">
                  {/* En-tête carte */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color}22` }}><Icon size={18} style={{ color: m.color }} /></div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-extrabold text-white truncate">{c.client || c.brand}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${m.color}1e`, color: m.color }}>{m.label}</span>
                        </div>
                        {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#06b6d4] inline-flex items-center gap-0.5 hover:underline">source <ExternalLink size={10} /></a>}
                      </div>
                    </div>
                    <button onClick={() => act(c.id, 'dismiss')} disabled={working}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg text-[#777] hover:text-white hover:bg-[#1c1c1c] inline-flex items-center gap-1 transition-colors shrink-0">
                      <X size={12} /> Passer
                    </button>
                  </div>

                  {c.actu && <p className="text-[12px] text-[#a8a8a8] mt-2.5 leading-snug">{c.actu}</p>}

                  {c.insight && (
                    <div className="mt-3 flex gap-2 items-start rounded-xl px-3 py-2.5" style={{ backgroundColor: `${m.color}12`, border: `1px solid ${m.color}33` }}>
                      <Sparkles size={14} style={{ color: m.color }} className="mt-0.5 shrink-0" />
                      <p className="text-[11.5px] leading-snug text-[#dcdcdc]"><span className="font-extrabold uppercase tracking-wide text-[10px]" style={{ color: m.color }}>Insight. </span>{c.insight}</p>
                    </div>
                  )}

                  {/* Moment + Concept */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                    <div className="rounded-xl bg-[#0d0d0d] border border-[#242424] p-3 flex flex-col gap-2">
                      {c.moment ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#06b6d4]">Moment</span>
                            <span className="text-[10px] font-extrabold text-[#06b6d4] bg-[#06b6d4]/12 px-2 py-0.5 rounded-md whitespace-nowrap">{c.moment.date}</span>
                          </div>
                          <p className="text-[13px] font-bold italic text-white leading-tight">{c.moment.title}</p>
                          <button onClick={() => act(c.id, 'integrate', { parts: ['moment'] })} disabled={working}
                            className="mt-auto self-start text-[11.5px] font-extrabold px-3 py-2 rounded-lg bg-[#06b6d4] text-[#042b33] hover:brightness-110 inline-flex items-center gap-1.5 transition-all disabled:opacity-50">
                            <Check size={13} /> Caler
                          </button>
                        </>
                      ) : <div className="flex items-center justify-center h-full min-h-[70px]"><span className="text-[11px] text-[#555] italic">Pas de moment daté</span></div>}
                    </div>

                    <div className="rounded-xl bg-[#0d0d0d] border border-[#242424] p-3 flex flex-col gap-2">
                      {c.concept ? (
                        <>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#4F9DF7]">Concept</span>
                          <p className="text-[14px] font-extrabold italic text-white leading-tight">{c.concept.name}</p>
                          {c.concept.desc && <p className="text-[11px] text-[#9a9a9a] leading-snug line-clamp-3" title={c.concept.desc}>{c.concept.desc}</p>}
                          <div className="flex flex-wrap gap-1.5">
                            {c.concept.offer && <span className="text-[9.5px] font-bold text-[#bbb] bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded">{c.concept.offer}</span>}
                            {c.concept.budget && <span className="text-[9.5px] font-bold text-[#4F9DF7] bg-[#4F9DF7]/10 px-1.5 py-0.5 rounded">{c.concept.budget}</span>}
                          </div>
                          <button onClick={() => act(c.id, 'integrate', { parts: ['concept'] })} disabled={working}
                            className="mt-auto self-start text-[11.5px] font-extrabold px-3 py-2 rounded-lg bg-[#4F9DF7] text-[#06243f] hover:brightness-110 inline-flex items-center gap-1.5 transition-all disabled:opacity-50">
                            <Check size={13} /> Ajouter
                          </button>
                        </>
                      ) : <div className="flex items-center justify-center h-full min-h-[70px]"><span className="text-[11px] text-[#555] italic">Pas de concept</span></div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
