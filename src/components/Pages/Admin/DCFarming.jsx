import { useState } from 'react';
import { Lightbulb, CalendarDays } from 'lucide-react';
import { FARMING_CLIENTS, FARMING_HADRIEN } from '../../../data/farmingHadrien';

// Badges de statut des concepts (allégés)
const TAG_STYLE = {
  piste:   { label: 'Piste',        cls: 'bg-[#fafaf7] text-[#0b0b0c]' },
  new:     { label: 'Nouveau',      cls: 'border border-[#3a3a3a] text-[#ccc]' },
  recond:  { label: 'Reconduction', cls: 'border border-dashed border-[#3a3a3a] text-[#888]' },
  proven:  { label: 'Prouvé',       cls: 'bg-[#5FC97A] text-[#0b0b0c]' },
  pari:    { label: 'Pari',         cls: 'border border-[#3a3a3a] text-[#888]' },
};

function ConceptCard({ c, color }) {
  const tag = TAG_STYLE[c.tag] || TAG_STYLE.new;
  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 flex flex-col gap-2"
      style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex justify-between items-baseline gap-3">
        <h4 className="font-extrabold italic uppercase text-sm text-white leading-tight">{c.name}</h4>
        {c.budget && <span className="text-xs font-bold text-[#888] whitespace-nowrap">{c.budget}</span>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#888]">{c.offer}</span>
        {c.timing && <span className="text-[10px] text-[#666]">· {c.timing}</span>}
        <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${tag.cls} ml-auto`}>{tag.label}</span>
      </div>
      {c.desc && <p className="text-xs text-[#bbb] leading-relaxed">{c.desc}</p>}
    </div>
  );
}

export default function DCFarming({ color }) {
  const [client, setClient] = useState(FARMING_CLIENTS[0]);
  const data = FARMING_HADRIEN[client] || { concepts: [], timeline: [] };
  const accent = data.col || color || '#e63946';

  return (
    <div className="space-y-5">
      {/* Sélecteur de client */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FARMING_CLIENTS.map(name => {
          const on = name === client;
          const c = FARMING_HADRIEN[name]?.col || '#666';
          return (
            <button key={name} onClick={() => setClient(name)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${on ? 'text-white' : 'text-[#ccc] border-[#2a2a2a] hover:text-white'}`}
              style={on ? { backgroundColor: c, borderColor: c } : { backgroundColor: '#161616' }}>
              {name}
            </button>
          );
        })}
      </div>

      {/* En-tête client */}
      <div className="flex items-end justify-between gap-4 border-b border-[#2a2a2a] pb-3">
        <h2 className="text-2xl font-black italic uppercase text-white leading-none" style={{ color: accent }}>{client}</h2>
        <div className="text-right">
          <div className="text-xl font-black italic text-white leading-none">{data.obj ? `${data.obj} K€` : '—'}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#666] mt-1">Objectif · MB {data.mb || '—'}</div>
        </div>
      </div>

      {/* ─── 1 · CONCEPT ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black italic" style={{ color: accent }}>1</span>
          <Lightbulb size={15} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Concept</h3>
          <span className="text-[10px] text-[#666] ml-auto">{data.concepts.length} idées</span>
        </div>
        {data.concepts.length === 0 ? (
          <p className="text-[#666] text-sm py-4 text-center">Aucun concept pour ce client.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {data.concepts.map((c, i) => <ConceptCard key={i} c={c} color={accent} />)}
          </div>
        )}
      </div>

      {/* ─── 2 · TIMELINE ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3 pt-2">
          <span className="text-xs font-black italic" style={{ color: accent }}>2</span>
          <CalendarDays size={15} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Timeline</h3>
          <span className="text-[10px] text-[#666] ml-auto">{data.timeline.length} moments forts</span>
        </div>
        {data.timeline.length === 0 ? (
          <p className="text-[#666] text-sm py-4 text-center">Aucun moment fort pour ce client.</p>
        ) : (
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg px-4 py-1">
            {data.timeline.map((t, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr] gap-3 py-3 border-t border-[#222] first:border-t-0">
                <div className="text-xs font-extrabold italic uppercase leading-tight" style={{ color: accent }}>{t.date}</div>
                <div>
                  <div className="text-sm font-semibold text-white leading-snug">{t.title}</div>
                  {t.sub && <div className="text-xs text-[#888] mt-0.5 leading-relaxed">{t.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
