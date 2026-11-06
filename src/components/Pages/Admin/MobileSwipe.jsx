import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, X, CalendarDays, Lightbulb, Radar, ArrowUpRight, Sparkles } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

// Univers → couleur d'accent (le scan pose `cat` sur la carte ; repli par mots-clés).
const CAT_COLORS = {
  Fitness: '#a3e635',
  Trail: '#ff5040',
  Running: '#ff5040',
  Tennis: '#ffd23c',
  Padel: '#ffd23c',
  Cyclisme: '#3ca0ff',
  Tech: '#06b6d4',
  Lifestyle: '#c084fc',
  Football: '#2ecc71',
  Basket: '#ff8a3d',
  Media: '#06b6d4',
  Auto: '#f43f5e',
  Hippisme: '#d9a441',
};
const KW = [
  { test: /hyrox|fitness|crossfit|salle/i, cat: 'Fitness' },
  { test: /trail|utmb|ultra|montagne/i, cat: 'Trail' },
  { test: /run|marathon|course|10 ?km/i, cat: 'Running' },
  { test: /tennis|raquette|roland/i, cat: 'Tennis' },
  { test: /padel/i, cat: 'Padel' },
  { test: /v[ée]lo|cycl|gravel|bike|tour de france/i, cat: 'Cyclisme' },
  { test: /basket|3x3/i, cat: 'Basket' },
  { test: /foot|ligue 1|\bom\b|psg|maillot/i, cat: 'Football' },
  { test: /\bf1\b|formule 1|alpine|moteur|grand prix/i, cat: 'Auto' },
  { test: /galop|hippodrome|\barc\b|cheval|hongre|longchamp/i, cat: 'Hippisme' },
  { test: /presse|m[ée]dia|provence/i, cat: 'Media' },
];
function catFor(c) {
  if (c.cat && CAT_COLORS[c.cat]) return c.cat;
  const hay = `${c.client || ''} ${c.actu || ''} ${c.concept?.offer || ''}`;
  return (KW.find(k => k.test.test(hay)) || { cat: 'Lifestyle' }).cat;
}
const colorFor = (c) => CAT_COLORS[catFor(c)] || '#e63946';

function todayLabel() {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Écran mobile « swipe » (isolé, route #swipe) : valider les opportunités à la main.
// Swipe droite ou ✓ = intégrer (moment + concept dans le Plan de jeu). Gauche ou ✗ = passer.
export default function MobileSwipe({ dc, onClose }) {
  const [cards, setCards] = useState(null);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState(null); // 'right' | 'left'
  const [done, setDone] = useState(0);
  const [kept, setKept] = useState(0);
  const startX = useRef(null);

  const load = useCallback(() => {
    apiFetch(`/api/data/opportunites?dc=${encodeURIComponent(dc)}`)
      .then(d => setCards(d.cards || []))
      .catch(() => setCards([]));
  }, [dc]);
  useEffect(() => { load(); }, [load]);

  const top = cards && cards[0];

  const act = (dir) => {
    if (!top || leaving) return;
    setLeaving(dir);
    const path = dir === 'right' ? 'integrate' : 'dismiss';
    apiFetch(`/api/data/opportunites/${path}`, { method: 'POST', body: JSON.stringify({ dc, id: top.id }) }).catch(() => {});
    setTimeout(() => {
      setCards(cs => cs.slice(1));
      setDrag(0); setLeaving(null);
      setDone(n => n + 1);
      if (dir === 'right') setKept(n => n + 1);
    }, 280);
  };

  const onStart = (e) => { if (leaving) return; startX.current = e.touches ? e.touches[0].clientX : e.clientX; };
  const onMove = (e) => { if (startX.current == null) return; const x = e.touches ? e.touches[0].clientX : e.clientX; setDrag(x - startX.current); };
  const onEnd = () => {
    if (startX.current == null) return;
    if (drag > 110) act('right');
    else if (drag < -110) act('left');
    else setDrag(0);
    startX.current = null;
  };

  const remaining = cards ? cards.length : 0;

  return (
    <div className="fixed inset-0 bg-[#070707] text-white flex flex-col select-none" style={{ touchAction: 'pan-y' }}>
      {/* halo d'ambiance */}
      <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl opacity-[0.18]"
        style={{ background: top ? colorFor(top) : '#e63946' }} />

      {/* En-tête */}
      <div className="relative flex items-end justify-between px-5 pb-3 border-b border-[#1a1a1a]" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#e63946]">
            <Sparkles size={11} /> Scan du matin
          </div>
          <div className="text-[19px] font-black italic leading-tight mt-0.5">{todayLabel()}</div>
          <div className="text-[11px] text-[#777] -mt-0.5">{dc} : {remaining} opportunité{remaining > 1 ? 's' : ''} à trier</div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[34px] font-black italic leading-none" style={{ color: top ? colorFor(top) : '#444' }}>{cards ? remaining : '…'}</div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#5a5a5a] mt-0.5">en attente</div>
        </div>
      </div>

      {/* Pile de cartes */}
      <div className="flex-1 relative overflow-hidden px-4 py-4">
        {cards === null && (
          <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" /></div>
        )}
        {cards && cards.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10">
            <div className="w-16 h-16 rounded-2xl bg-[#101010] border border-[#242424] flex items-center justify-center mb-4"><Radar size={30} className="text-[#2ecc71]" /></div>
            <p className="text-lg font-black italic text-white">Tout est trié.</p>
            <p className="text-[13px] text-[#777] mt-1.5 leading-snug">
              {done > 0 ? <>Tu as gardé <span className="font-extrabold text-[#2ecc71]">{kept}</span> opportunité{kept > 1 ? 's' : ''} sur {done}. Elles sont dans ton Plan de jeu.</> : 'Rien à trier pour le moment. Le prochain scan arrive demain matin.'}
            </p>
            <button onClick={onClose} className="mt-6 text-[13px] font-bold px-5 py-3 rounded-2xl bg-[#141414] border border-[#2a2a2a] text-[#ddd] active:scale-95 transition-transform">Fermer</button>
          </div>
        )}

        {/* 2e et 3e cartes en profondeur */}
        {cards && cards[2] && (
          <div className="absolute inset-x-8 top-7 bottom-7 rounded-3xl bg-[#0e0e0e] border border-[#1c1c1c]" style={{ transform: 'scale(0.9)' }} />
        )}
        {cards && cards[1] && (
          <div className="absolute inset-x-6 top-5 bottom-5 rounded-3xl bg-[#111] border border-[#202020]" style={{ transform: 'scale(0.95)' }} />
        )}

        {/* carte du dessus */}
        {top && (() => {
          const col = colorFor(top);
          const cat = catFor(top);
          const dx = leaving === 'right' ? 520 : leaving === 'left' ? -520 : drag;
          const yes = Math.max(0, Math.min(1, dx / 110));
          const no = Math.max(0, Math.min(1, -dx / 110));
          return (
            <div
              onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
              onMouseDown={onStart} onMouseMove={e => startX.current != null && onMove(e)} onMouseUp={onEnd} onMouseLeave={() => startX.current != null && onEnd()}
              className="absolute inset-x-4 top-4 bottom-4 rounded-3xl overflow-hidden flex flex-col border"
              style={{
                borderColor: '#262626',
                background: 'linear-gradient(170deg,#171717 0%,#0d0d0d 60%)',
                transform: `translateX(${dx}px) rotate(${dx / 24}deg)`,
                transition: (leaving || startX.current == null) ? 'transform .28s cubic-bezier(.22,1,.36,1)' : 'none',
                boxShadow: '0 24px 60px rgba(0,0,0,.6)',
              }}>
              {/* bandeau d'accent */}
              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg,${col},${col}00)` }} />

              {/* badges swipe */}
              <div className="pointer-events-none absolute top-6 left-6 text-[#2ecc71] font-black italic text-2xl border-[3px] border-[#2ecc71] rounded-xl px-2.5 py-0.5 rotate-[-13deg]" style={{ opacity: yes }}>GARDER</div>
              <div className="pointer-events-none absolute top-6 right-6 text-[#e63946] font-black italic text-2xl border-[3px] border-[#e63946] rounded-xl px-2.5 py-0.5 rotate-[13deg]" style={{ opacity: no }}>PASSER</div>

              <div className="p-5 pt-4 flex flex-col gap-3.5 overflow-y-auto">
                {/* pastille univers */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full" style={{ color: col, backgroundColor: `${col}1a`, border: `1px solid ${col}40` }}>{cat}</span>
                  {top.hot && <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] px-2 py-1 rounded-full text-[#e63946] bg-[#e63946]/10 border border-[#e63946]/40">À ne pas rater</span>}
                </div>

                {/* marque + source */}
                <div>
                  <div className="text-[26px] font-black italic text-white leading-[1.05] tracking-tight">{top.client || top.brand}</div>
                  {top.source && (
                    <a href={top.source.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-[#7a7a7a] mt-1 hover:text-[#aaa]">
                      via {top.source.name} <ArrowUpRight size={11} />
                    </a>
                  )}
                </div>

                {/* actu */}
                {top.actu && <p className="text-[13.5px] text-[#c4c4c4] leading-snug">{top.actu}</p>}

                {/* insight */}
                {top.insight && (
                  <div className="rounded-2xl px-3.5 py-3" style={{ backgroundColor: `${col}12`, border: `1px solid ${col}2e` }}>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: col }}>L'angle SPK</div>
                    <p className="text-[12.5px] text-[#e8e8e8] leading-snug">{top.insight}</p>
                  </div>
                )}

                {/* moment */}
                {top.moment && (
                  <div className="rounded-2xl bg-[#0b0b0b] border border-[#232323] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#06b6d4] flex items-center gap-1.5"><CalendarDays size={13} /> Moment à caler</span>
                      <span className="text-[11px] font-extrabold text-[#06b6d4] bg-[#06b6d4]/10 px-2 py-0.5 rounded-md">{top.moment.date}</span>
                    </div>
                    <p className="text-[15px] font-extrabold italic text-white mt-1.5 leading-snug">{top.moment.title}</p>
                  </div>
                )}

                {/* concept */}
                {top.concept && (
                  <div className="rounded-2xl bg-[#0b0b0b] border border-[#232323] p-3.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#4F9DF7] flex items-center gap-1.5"><Lightbulb size={13} /> Concept à pousser</span>
                    <p className="text-[16px] font-black italic text-white mt-1.5 leading-tight">{top.concept.name}</p>
                    {top.concept.desc && <p className="text-[12.5px] text-[#9a9a9a] mt-1.5 leading-snug">{top.concept.desc}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {top.concept.offer && <span className="text-[10px] font-bold text-[#cfcfcf] bg-[#1a1a1a] border border-[#2c2c2c] px-2.5 py-1 rounded-lg">{top.concept.offer}</span>}
                      {top.concept.budget && <span className="text-[10px] font-extrabold text-[#4F9DF7] bg-[#4F9DF7]/12 border border-[#4F9DF7]/25 px-2.5 py-1 rounded-lg">{top.concept.budget}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Boutons (alternative au swipe) */}
      {top && (
        <div className="relative flex items-center justify-center gap-10 px-4 pb-1 pt-1">
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => act('left')} aria-label="Passer" className="w-[62px] h-[62px] rounded-full bg-[#121212] border-2 border-[#e63946] flex items-center justify-center active:scale-90 transition-transform shadow-[0_8px_24px_rgba(230,57,70,0.25)]"><X size={27} className="text-[#e63946]" strokeWidth={2.5} /></button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#555]">Passer</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => act('right')} aria-label="Garder" className="w-[62px] h-[62px] rounded-full bg-[#121212] border-2 border-[#2ecc71] flex items-center justify-center active:scale-90 transition-transform shadow-[0_8px_24px_rgba(46,204,113,0.25)]"><Check size={28} className="text-[#2ecc71]" strokeWidth={2.5} /></button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#555]">Garder</span>
          </div>
        </div>
      )}
      {top && <p className="text-center text-[10px] text-[#444] pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">Swipe à droite pour garder, à gauche pour passer</p>}
    </div>
  );
}
