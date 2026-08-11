import { useState, useEffect } from 'react';
import { Lightbulb, CalendarDays } from 'lucide-react';
import { FARMING_CLIENTS, FARMING_HADRIEN, FARMING_MONTHS } from '../../../data/farmingHadrien';

// Statut → température (repris du board farming original)
const STATUS_COLS = [
  { key: '',         head: 'À qualifier', heat: 'À qualifier',        headCls: 'bg-[#2a2a2a] text-[#eee]',  therm: 0, barderm: null },
  { key: 'Idée',     head: '❄ Froid',     heat: '❄ Froid · Idée',     headCls: 'bg-[#4F9DF7] text-[#0b0b0c]', therm: 1, barderm: '#4F9DF7' },
  { key: 'En cours', head: '◐ Tiède',     heat: '◐ Tiède · En cours', headCls: 'bg-[#E6A23C] text-[#0b0b0c]', therm: 2, barderm: '#E6A23C' },
  { key: 'Pitché',   head: '🔥 Chaud',    heat: '🔥 Chaud · Pitché',  headCls: 'bg-[#EF5350] text-white',    therm: 3, barderm: '#EF5350' },
];
const heatOf = (key) => STATUS_COLS.find(s => s.key === key) || STATUS_COLS[0];

const TAG = {
  piste:  { l: '= PISTE BP', cls: 'bg-[#fafaf7] text-[#0b0b0c]' },
  new:    { l: 'NET NEW',    cls: 'border border-[#3a3a3a] text-[#ccc]' },
  recond: { l: '↻ RECOND',   cls: 'border border-dashed border-[#3a3a3a] text-[#888]' },
};

const LS_KEY = 'spk_dc_farming_status_v1';
const pkey = (client, name) => `${client}::${name}`;

function Thermometer({ level }) {
  const seg = ['#4F9DF7', '#E6A23C', '#EF5350'];
  return (
    <span className="inline-flex gap-[2px] items-center">
      {seg.map((c, i) => (
        <i key={i} className="w-3 h-[5px] rounded-full" style={{ backgroundColor: level >= i + 1 ? c : 'rgba(250,250,247,.14)' }} />
      ))}
    </span>
  );
}

function ConceptCard({ concept, client, status, color, onDragStart }) {
  const st = heatOf(status);
  const tag = TAG[concept.tag];
  return (
    <div draggable onDragStart={onDragStart}
      className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-md p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing"
      style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex justify-between items-baseline gap-2">
        <div className="min-w-0">
          <span className="font-extrabold italic uppercase text-[13px] text-white leading-tight">{concept.name}</span>
          <span className="inline-flex gap-1 ml-1.5 align-middle">
            {tag && <span className={`text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded-sm ${tag.cls}`}>{tag.l}</span>}
            {concept.proven && <span className="text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded-sm bg-[#5FC97A] text-[#0b0b0c]">✓ Déjà prouvé</span>}
          </span>
        </div>
        {concept.budget && <span className="text-[11px] font-bold text-[#888] whitespace-nowrap shrink-0">{concept.budget}</span>}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
        {concept.offer}{concept.moment ? ` · ${concept.moment}` : ''}
      </div>
      {concept.desc && <p className="text-[11px] text-[#bbb] leading-relaxed">{concept.desc}</p>}
      <div className="flex items-center gap-2 border-t border-[#1e1e1e] pt-2 mt-0.5">
        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-sm" style={
          st.key === '' ? { border: '1px solid #3a3a3a', color: '#888' } : { backgroundColor: st.barderm, color: st.key === 'Pitché' ? '#fff' : '#0b0b0c' }
        }>{st.heat}</span>
        <Thermometer level={st.therm} />
      </div>
    </div>
  );
}

// Gantt : une ligne = label + barre positionnée sur 15 mois
function GanttRow({ label, marker, span, color, filled }) {
  const [s, e] = span || [0, 0];
  return (
    <div className="grid items-center min-h-[30px] border-t border-[rgba(250,250,247,.05)]"
      style={{ gridTemplateColumns: '180px repeat(15, minmax(26px, 1fr))' }}>
      <div className="text-[11px] text-[#ccc] pr-2 truncate flex items-center gap-1">
        <span style={{ color }}>{marker}</span>{label}
      </div>
      <div className="h-[26px] flex items-center" style={{ gridColumn: `${s + 2} / ${e + 3}` }}>
        <div className="h-[14px] w-full rounded-full flex items-center px-1.5 text-[8px] font-bold italic overflow-hidden whitespace-nowrap"
          style={filled ? { backgroundColor: color, color: '#0b0b0c' } : { border: `1px solid ${color}`, color }}>
          {filled ? '' : ''}
        </div>
      </div>
    </div>
  );
}

export default function DCFarming() {
  const [client, setClient] = useState(FARMING_CLIENTS[0]);
  const [status, setStatus] = useState({});
  const [dragged, setDragged] = useState(null);
  const [overCol, setOverCol] = useState(null);

  // Persistance du statut (comme le board original, dans le navigateur)
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s) setStatus(s); } catch (e) { /* ignore */ }
  }, []);
  const setCardStatus = (name, colKey) => {
    setStatus(prev => {
      const next = { ...prev, [pkey(client, name)]: colKey };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  };

  const data = FARMING_HADRIEN[client] || { concepts: [], timeline: [], col: '#e63946' };
  const accent = data.col || '#e63946';
  const concepts = data.concepts || [];
  const statusOf = (name) => status[pkey(client, name)] || '';

  const handleDrop = (colKey) => { if (dragged) setCardStatus(dragged, colKey); setDragged(null); setOverCol(null); };

  return (
    <div className="space-y-6">
      {/* Sélecteur de client */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FARMING_CLIENTS.map(name => {
          const on = name === client;
          const c = FARMING_HADRIEN[name]?.col || '#666';
          return (
            <button key={name} onClick={() => setClient(name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${on ? 'text-white' : 'text-[#ccc] border-[#2a2a2a] hover:text-white'}`}
              style={on ? { backgroundColor: c, borderColor: c } : { backgroundColor: '#161616' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />{name}
            </button>
          );
        })}
      </div>

      {/* En-tête client */}
      <div className="flex items-end justify-between gap-4 border-b border-[#2a2a2a] pb-3">
        <h2 className="text-2xl font-black italic uppercase leading-none" style={{ color: accent }}>{client}</h2>
        <div className="text-right">
          <div className="text-xl font-black italic text-white leading-none">{data.obj ? `${data.obj} K€` : '—'}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#666] mt-1">Objectif BP · MB {data.mb || '—'}</div>
        </div>
      </div>

      {/* ─── 1 · CONCEPT (kanban température) ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black italic" style={{ color: accent }}>1</span>
          <Lightbulb size={15} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Concept</h3>
          <span className="text-[10px] text-[#666] ml-auto">Glisser une carte d'une colonne à l'autre pour la qualifier</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 items-start">
          {STATUS_COLS.map(col => {
            const items = concepts.filter(c => statusOf(c.name) === col.key);
            return (
              <div key={col.key} className="flex flex-col min-w-0">
                <div className={`text-[11px] font-black uppercase tracking-wide text-center py-2 rounded-t-md ${col.headCls}`}>
                  {col.head} · {items.length}
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setOverCol(col.key); }}
                  onDragLeave={() => setOverCol(o => (o === col.key ? null : o))}
                  onDrop={() => handleDrop(col.key)}
                  className={`flex flex-col gap-2.5 p-2.5 rounded-b-md border border-t-0 border-[#2a2a2a] min-h-[90px] transition-colors ${overCol === col.key ? 'bg-[rgba(250,250,247,.07)]' : 'bg-[rgba(250,250,247,.02)]'}`}>
                  {items.length === 0
                    ? <div className="text-[#555] text-[10px] text-center py-5 uppercase tracking-wide font-bold">déposer ici</div>
                    : items.map(c => (
                      <ConceptCard key={c.name} concept={c} client={client} status={col.key} color={accent}
                        onDragStart={() => setDragged(c.name)} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 2 · TIMELINE (événements marque + concepts) ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3 pt-2">
          <span className="text-xs font-black italic" style={{ color: accent }}>2</span>
          <CalendarDays size={15} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Timeline — saison 26/27</h3>
        </div>

        {/* Gantt */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 overflow-x-auto">
          <div style={{ minWidth: 860 }}>
            {/* Header mois */}
            <div className="grid border-b border-[#2a2a2a] mb-1" style={{ gridTemplateColumns: '180px repeat(15, minmax(26px, 1fr))' }}>
              <div />
              {FARMING_MONTHS.map((m, i) => (
                <div key={i} className={`text-[8px] font-bold uppercase text-center py-1 border-l border-[#222] ${i === 0 || i === 12 ? 'text-white' : 'text-[#666]'}`}>{m}</div>
              ))}
            </div>
            {/* Lane événements marque */}
            <div className="text-[10px] font-black uppercase tracking-wider py-2" style={{ color: accent }}>◇ Événements marque ({data.timeline.length})</div>
            {data.timeline.map((ev, i) => (
              <GanttRow key={`ev-${i}`} label={ev.title} marker="◇" span={ev.span} color={accent} filled={false} />
            ))}
            {/* Lane concepts SPK */}
            <div className="text-[10px] font-black uppercase tracking-wider py-2 mt-1" style={{ color: accent }}>● Concepts SPK ({concepts.length})</div>
            {concepts.map((c, i) => (
              <GanttRow key={`pj-${i}`} label={c.name} marker="●" span={c.span} color={accent} filled={true} />
            ))}
          </div>
        </div>

        {/* Liste des moments forts (détail événements marque) */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg px-4 py-1 mt-3">
          {data.timeline.map((ev, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-3 py-3 border-t border-[#222] first:border-t-0">
              <div className="text-xs font-extrabold italic uppercase leading-tight" style={{ color: accent }}>{ev.date || '—'}</div>
              <div>
                <div className="text-sm font-semibold text-white leading-snug">{ev.title}</div>
                {ev.sub && <div className="text-xs text-[#888] mt-0.5 leading-relaxed">{ev.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
