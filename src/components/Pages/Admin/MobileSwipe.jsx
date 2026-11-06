import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, X, Calendar, Lightbulb, Radar } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

const CATS = [
  { test: /hyrox|fitness|run|trail|marathon/i, color: '#a3e635' },
  { test: /basket|3x3/i, color: '#ff8a3d' },
  { test: /provence|m[ée]dia|presse/i, color: '#06b6d4' },
  { test: /foot|ligue 1|\bom\b|psg/i, color: '#22c55e' },
];
const colorFor = (c) => (CATS.find(x => x.test.test(`${c.client || ''} ${c.actu || ''}`)) || { color: '#e63946' }).color;

// Écran mobile « swipe » (isolé, route #swipe) : valider les opportunités à la main.
// Swipe droite ou ✓ = intégrer (moment + concept dans le Plan de jeu). Gauche ou ✗ = passer.
export default function MobileSwipe({ dc, onClose }) {
  const [cards, setCards] = useState(null);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState(null); // 'right' | 'left'
  const [done, setDone] = useState(0);
  const startX = useRef(null);

  const load = useCallback(() => {
    apiFetch(`/api/data/opportunites?dc=${encodeURIComponent(dc)}`)
      .then(d => setCards(d.cards || []))
      .catch(() => setCards([]));
  }, [dc]);
  useEffect(() => { load(); }, [load]);

  const top = cards && cards[0];

  const act = (dir) => {
    if (!top) return;
    setLeaving(dir);
    const path = dir === 'right' ? 'integrate' : 'dismiss';
    apiFetch(`/api/data/opportunites/${path}`, { method: 'POST', body: JSON.stringify({ dc, id: top.id }) }).catch(() => {});
    setTimeout(() => {
      setCards(cs => cs.slice(1));
      setDrag(0); setLeaving(null); setDone(n => n + 1);
    }, 260);
  };

  const onStart = (e) => { startX.current = e.touches ? e.touches[0].clientX : e.clientX; };
  const onMove = (e) => { if (startX.current == null) return; const x = e.touches ? e.touches[0].clientX : e.clientX; setDrag(x - startX.current); };
  const onEnd = () => {
    if (startX.current == null) return;
    if (drag > 110) act('right');
    else if (drag < -110) act('left');
    else setDrag(0);
    startX.current = null;
  };

  const total = (cards ? cards.length : 0) + done;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white flex flex-col select-none" style={{ touchAction: 'pan-y' }}>
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] pb-2 border-b border-[#1c1c1c]" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div>
          <div className="text-base font-extrabold italic">Scan du matin</div>
          <div className="text-[11px] text-[#888]">{dc}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold italic text-[#e63946] leading-none">{cards ? cards.length : '…'}</div>
          <div className="text-[9px] uppercase tracking-wider text-[#666]">à trier</div>
        </div>
      </div>

      {/* Pile de cartes */}
      <div className="flex-1 relative overflow-hidden px-4 py-4">
        {cards === null && (
          <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" /></div>
        )}
        {cards && cards.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <Radar size={34} className="text-[#333] mb-3" />
            <p className="text-sm font-bold text-[#ddd]">Tout est trié.</p>
            <p className="text-xs text-[#666] mt-1">{done > 0 ? `${done} opportunité${done > 1 ? 's' : ''} traitée${done > 1 ? 's' : ''} ce matin.` : 'Rien à trier pour le moment.'}</p>
            <button onClick={onClose} className="mt-5 text-xs font-bold px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#ccc]">Fermer</button>
          </div>
        )}
        {/* carte suivante (dessous) */}
        {cards && cards[1] && (
          <div className="absolute inset-x-4 top-4 bottom-4 rounded-2xl bg-[#121212] border border-[#242424] scale-95 opacity-60" />
        )}
        {/* carte du dessus */}
        {top && (() => {
          const col = colorFor(top);
          const dx = leaving === 'right' ? 500 : leaving === 'left' ? -500 : drag;
          const yes = Math.max(0, Math.min(1, dx / 110));
          const no = Math.max(0, Math.min(1, -dx / 110));
          return (
            <div
              onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
              onMouseDown={onStart} onMouseMove={e => startX.current != null && onMove(e)} onMouseUp={onEnd} onMouseLeave={() => startX.current != null && onEnd()}
              className="absolute inset-x-4 top-4 bottom-4 rounded-2xl bg-[#141414] border overflow-hidden flex flex-col"
              style={{ borderColor: '#2a2a2a', transform: `translateX(${dx}px) rotate(${dx / 22}deg)`, transition: (leaving || startX.current == null) ? 'transform .26s ease' : 'none', boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
              <div className="h-1.5" style={{ backgroundColor: col }} />
              {/* badges swipe */}
              <div className="pointer-events-none absolute top-5 left-5 text-[#2ecc71] font-extrabold italic text-2xl border-2 border-[#2ecc71] rounded-lg px-2 rotate-[-12deg]" style={{ opacity: yes }}>GARDER</div>
              <div className="pointer-events-none absolute top-5 right-5 text-[#e63946] font-extrabold italic text-2xl border-2 border-[#e63946] rounded-lg px-2 rotate-[12deg]" style={{ opacity: no }}>PASSER</div>

              <div className="p-5 flex flex-col gap-3 overflow-y-auto">
                <div className="text-lg font-extrabold text-white">{top.client || top.brand}</div>
                {top.actu && <p className="text-[13px] text-[#bbb] leading-snug">{top.actu}</p>}
                {top.insight && (
                  <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: `${col}14`, border: `1px solid ${col}33` }}>
                    <p className="text-[12px] text-[#e2e2e2] leading-snug"><span className="font-extrabold uppercase text-[10px]" style={{ color: col }}>Insight. </span>{top.insight}</p>
                  </div>
                )}
                {top.moment && (
                  <div className="rounded-xl bg-[#0d0d0d] border border-[#242424] p-3">
                    <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-[#06b6d4] flex items-center gap-1"><Calendar size={12} /> Moment</span><span className="text-[11px] font-extrabold text-[#06b6d4]">{top.moment.date}</span></div>
                    <p className="text-sm font-bold italic text-white mt-1">{top.moment.title}</p>
                  </div>
                )}
                {top.concept && (
                  <div className="rounded-xl bg-[#0d0d0d] border border-[#242424] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4F9DF7] flex items-center gap-1"><Lightbulb size={12} /> Concept</span>
                    <p className="text-[15px] font-extrabold italic text-white mt-1 leading-tight">{top.concept.name}</p>
                    {top.concept.desc && <p className="text-[12px] text-[#9a9a9a] mt-1 leading-snug">{top.concept.desc}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {top.concept.offer && <span className="text-[10px] font-bold text-[#bbb] bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-0.5 rounded">{top.concept.offer}</span>}
                      {top.concept.budget && <span className="text-[10px] font-bold text-[#4F9DF7] bg-[#4F9DF7]/10 px-2 py-0.5 rounded">{top.concept.budget}</span>}
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
        <div className="flex items-center justify-center gap-8 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
          <button onClick={() => act('left')} aria-label="Passer" className="w-16 h-16 rounded-full bg-[#141414] border-2 border-[#e63946] flex items-center justify-center active:scale-95 transition-transform"><X size={28} className="text-[#e63946]" /></button>
          <button onClick={() => act('right')} aria-label="Garder" className="w-16 h-16 rounded-full bg-[#141414] border-2 border-[#2ecc71] flex items-center justify-center active:scale-95 transition-transform"><Check size={28} className="text-[#2ecc71]" /></button>
        </div>
      )}
      {top && <p className="text-center text-[10px] text-[#555] pb-[max(10px,env(safe-area-inset-bottom))]">Swipe à droite pour garder, à gauche pour passer</p>}
    </div>
  );
}
