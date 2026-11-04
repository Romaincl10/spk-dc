import { useState, useEffect, useCallback } from 'react';
import { Radar, Calendar, Lightbulb, Check, X, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

// Écran « Scan du matin » : cartes d'opportunités (moments + concepts) déposées par le scan,
// intégrables en un clic dans le Plan de jeu du DC (moment → timeline, concept → kanban Froid).
export default function Opportunites({ dc, onChanged }) {
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(null); // id en cours d'action

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
      load();
      onChanged?.();
    } catch (e) { console.error('[Opp] action', e); }
    setBusy(null);
  };

  if (cards === null) {
    return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#e63946]/15 flex items-center justify-center"><Radar size={20} className="text-[#e63946]" /></div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Scan du matin : {dc}</h2>
          <p className="text-[#888] text-sm">{cards.length === 0 ? 'Aucune opportunité en attente' : `${cards.length} opportunité${cards.length > 1 ? 's' : ''} à traiter : intègre ou passe`}</p>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-10 text-center">
          <Radar size={28} className="text-[#333] mx-auto mb-3" />
          <p className="text-[#888] text-sm">Rien ce matin. Le prochain scan déposera ici les nouvelles opportunités de ton portefeuille.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(c => {
            const working = busy === c.id;
            return (
              <div key={c.id} className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 pt-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-extrabold text-white truncate">{c.client || c.brand || ''}</span>
                    {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#06b6d4] inline-flex items-center gap-0.5 hover:underline shrink-0">source <ExternalLink size={10} /></a>}
                  </div>
                  <button onClick={() => act(c.id, 'dismiss')} disabled={working}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg text-[#888] hover:text-white hover:bg-[#1c1c1c] inline-flex items-center gap-1 transition-colors">
                    <X size={12} /> Passer
                  </button>
                </div>
                {c.actu && <p className="text-[12.5px] text-[#cfcfcf] px-4 pt-2">{c.actu}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[#2a2a2a] mt-3">
                  {/* Moment */}
                  <div className="bg-[#141414] p-4 flex flex-col gap-2">
                    {c.moment ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#06b6d4]"><Calendar size={13} /> Moment</div>
                        <p className="text-sm font-bold italic text-white">{c.moment.title}</p>
                        <p className="text-[11px] font-bold text-[#06b6d4]">{c.moment.date}</p>
                        <button onClick={() => act(c.id, 'integrate', { parts: ['moment'] })} disabled={working}
                          className="mt-auto self-start text-xs font-extrabold px-3 py-2 rounded-lg bg-[#06b6d4] text-[#042b33] hover:brightness-110 inline-flex items-center gap-1.5 transition-all disabled:opacity-50">
                          <Check size={13} /> Caler dans la timeline
                        </button>
                      </>
                    ) : <p className="text-[11px] text-[#555] italic">Pas de moment daté</p>}
                  </div>
                  {/* Concept */}
                  <div className="bg-[#141414] p-4 flex flex-col gap-2">
                    {c.concept ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4F9DF7]"><Lightbulb size={13} /> Concept</div>
                        <p className="text-sm font-bold italic text-white">{c.concept.name}</p>
                        {c.concept.desc && <p className="text-[11.5px] text-[#bbb] leading-snug">{c.concept.desc}</p>}
                        <p className="text-[10.5px] text-[#888]">{[c.concept.offer, c.concept.budget].filter(Boolean).join(' · ')}</p>
                        <button onClick={() => act(c.id, 'integrate', { parts: ['concept'] })} disabled={working}
                          className="mt-auto self-start text-xs font-extrabold px-3 py-2 rounded-lg bg-[#4F9DF7] text-[#06243f] hover:brightness-110 inline-flex items-center gap-1.5 transition-all disabled:opacity-50">
                          <Check size={13} /> Ajouter le concept
                        </button>
                      </>
                    ) : <p className="text-[11px] text-[#555] italic">Pas de concept</p>}
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
