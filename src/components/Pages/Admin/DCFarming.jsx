import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, CalendarDays, GanttChartSquare, Pencil, Trash2, Plus, RotateCcw, X, Check, Archive } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

const MONTHS = ['Juin 26', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan 27', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin 27', 'Juil', 'Août'];
const MLABEL = ['Juin 26', 'Juil 26', 'Août 26', 'Sept 26', 'Oct 26', 'Nov 26', 'Déc 26', 'Jan 27', 'Fév 27', 'Mars 27', 'Avr 27', 'Mai 27', 'Juin 27', 'Juil 27', 'Août 27'];
const momentLabel = (sp) => !sp ? '' : (sp[0] === sp[1] ? MLABEL[sp[0]] : `${MLABEL[sp[0]]} → ${MLABEL[sp[1]]}`);
const genId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const nowISO = () => new Date().toISOString();
const GRID = '240px repeat(15, minmax(24px, 1fr))';

const STATUS_COLS = [
  { key: '',         head: 'À qualifier', heat: 'À qualifier',        headCls: 'bg-[#2a2a2a] text-[#eee]',    therm: 0, c: null },
  { key: 'Idée',     head: '❄ Froid',     heat: '❄ Froid · Idée',     headCls: 'bg-[#4F9DF7] text-[#0b0b0c]', therm: 1, c: '#4F9DF7' },
  { key: 'En cours', head: '◐ Tiède',     heat: '◐ Tiède · En cours', headCls: 'bg-[#E6A23C] text-[#0b0b0c]', therm: 2, c: '#E6A23C' },
  { key: 'Pitché',   head: '🔥 Chaud',    heat: '🔥 Chaud · Pitché',  headCls: 'bg-[#EF5350] text-white',     therm: 3, c: '#EF5350' },
];
const heatOf = (key) => STATUS_COLS.find(s => s.key === key) || STATUS_COLS[0];

function Thermometer({ level }) {
  const seg = ['#4F9DF7', '#E6A23C', '#EF5350'];
  return (
    <span className="inline-flex gap-[2px] items-center">
      {seg.map((c, i) => <i key={i} className="w-3 h-[5px] rounded-full" style={{ backgroundColor: level >= i + 1 ? c : 'rgba(250,250,247,.14)' }} />)}
    </span>
  );
}

const btnCls = 'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded transition-colors';

// ─── Formulaire d'édition d'un concept ───
function ConceptForm({ initial, color, onSave, onCancel }) {
  const [f, setF] = useState(() => ({
    name: initial.name || '', offer: initial.offer || '', timing: initial.timing || '',
    desc: initial.desc || '', budget: initial.budget || '',
    s0: initial.span?.[0] ?? 0, s1: initial.span?.[1] ?? 1,
  }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.name.trim()) return;
    const s0 = Math.min(+f.s0, +f.s1), s1 = Math.max(+f.s0, +f.s1);
    onSave({ name: f.name.trim(), offer: f.offer.trim(), timing: f.timing.trim(), desc: f.desc.trim(), budget: f.budget.trim(), span: [s0, s1], moment: momentLabel([s0, s1]) });
  };
  const inp = 'bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#666] w-full';
  return (
    <div className="bg-[#0d0d0d] border rounded-md p-3 flex flex-col gap-2" style={{ borderLeft: `3px solid ${color}` }}>
      <input className={inp} placeholder="Nom du concept" value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
      <input className={inp} placeholder="Offre (Event · BC · Influence…)" value={f.offer} onChange={e => set('offer', e.target.value)} />
      <input className={inp} placeholder="Moment / déclencheur" value={f.timing} onChange={e => set('timing', e.target.value)} />
      <textarea className={`${inp} resize-none h-14`} placeholder="Description" value={f.desc} onChange={e => set('desc', e.target.value)} />
      <div className="flex gap-2 items-center">
        <input className={`${inp} w-28`} placeholder="Budget" value={f.budget} onChange={e => set('budget', e.target.value)} />
        <span className="text-[10px] text-[#666] shrink-0">Période</span>
        <select className={`${inp} flex-1`} value={f.s0} onChange={e => set('s0', e.target.value)}>{MLABEL.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
        <span className="text-[#666]">→</span>
        <select className={`${inp} flex-1`} value={f.s1} onChange={e => set('s1', e.target.value)}>{MLABEL.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className={`${btnCls} text-[#888] hover:text-white`}><X size={12} /> Annuler</button>
        <button onClick={save} className={`${btnCls} bg-[#fafaf7] text-[#0b0b0c]`}><Check size={12} /> Enregistrer</button>
      </div>
    </div>
  );
}

// ─── Carte concept (lecture) ───
function ConceptCard({ concept, color, onDragStart, onEdit, onArchive }) {
  const st = heatOf(concept.status);
  return (
    <div draggable onDragStart={onDragStart}
      className="group bg-[#0d0d0d] border border-[#2a2a2a] rounded-md p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing"
      style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex justify-between items-baseline gap-2">
        <div className="min-w-0">
          <span className="font-extrabold italic uppercase text-[13px] text-white leading-tight">{concept.name}</span>
          {concept.proven && <span className="ml-1.5 text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded-sm bg-[#5FC97A] text-[#0b0b0c] align-middle">✓ Déjà prouvé</span>}
        </div>
        {concept.budget && <span className="text-[11px] font-bold text-[#888] whitespace-nowrap shrink-0">{concept.budget}</span>}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
        {concept.offer}{concept.moment ? ` · ${concept.moment}` : ''}
      </div>
      {concept.desc && <p className="text-[11px] text-[#bbb] leading-relaxed">{concept.desc}</p>}
      <div className="flex items-center gap-2 border-t border-[#1e1e1e] pt-2 mt-0.5">
        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-sm" style={
          st.key === '' ? { border: '1px solid #3a3a3a', color: '#888' } : { backgroundColor: st.c, color: st.key === 'Pitché' ? '#fff' : '#0b0b0c' }
        }>{st.heat}</span>
        <Thermometer level={st.therm} />
        <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} title="Modifier" className="text-[#888] hover:text-white p-0.5"><Pencil size={13} /></button>
          <button onClick={onArchive} title="Supprimer (corbeille)" className="text-[#888] hover:text-[#EA5E7B] p-0.5"><Trash2 size={13} /></button>
        </span>
      </div>
    </div>
  );
}

// ─── Ligne du Gantt : label complet (2 lignes) + barre ───
function GanttRow({ label, sub, marker, span, color, filled }) {
  const [s, e] = span || [0, 0];
  return (
    <div className="grid items-center min-h-[34px] border-t border-[rgba(250,250,247,.05)]" style={{ gridTemplateColumns: GRID }}>
      <div className="pr-3 py-1 flex items-start gap-1.5 leading-tight">
        <span className="shrink-0 mt-0.5" style={{ color }}>{marker}</span>
        <span className="text-[11px] text-[#ddd] break-words" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {label}{sub ? <span className="text-[#666]"> · {momentLabel(span)}</span> : null}
        </span>
      </div>
      <div className="h-[22px] flex items-center" style={{ gridColumn: `${s + 2} / ${e + 3}` }}>
        <div className="h-[13px] w-full rounded-full" style={filled ? { backgroundColor: color } : { border: `1.5px solid ${color}` }} />
      </div>
    </div>
  );
}

// ─── Formulaire d'édition d'un événement ───
function EventForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(() => ({ date: initial.date || '', title: initial.title || '', sub: initial.sub || '', s0: initial.span?.[0] ?? 0, s1: initial.span?.[1] ?? 0 }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = () => { if (!f.title.trim()) return; const s0 = Math.min(+f.s0, +f.s1), s1 = Math.max(+f.s0, +f.s1); onSave({ date: f.date.trim(), title: f.title.trim(), sub: f.sub.trim(), span: [s0, s1] }); };
  const inp = 'bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#666]';
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-3 border-t border-[#222]">
      <input className={`${inp} w-full`} placeholder="Date de début (ex. Juin 2026)" value={f.date} onChange={e => set('date', e.target.value)} autoFocus />
      <div className="flex flex-col gap-2">
        <input className={`${inp} w-full`} placeholder="Événement marque" value={f.title} onChange={e => set('title', e.target.value)} />
        <input className={`${inp} w-full`} placeholder="Précision (optionnel)" value={f.sub} onChange={e => set('sub', e.target.value)} />
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-[#666]">Période</span>
          <select className={`${inp} flex-1`} value={f.s0} onChange={e => set('s0', e.target.value)}>{MLABEL.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
          <span className="text-[#666]">→</span>
          <select className={`${inp} flex-1`} value={f.s1} onChange={e => set('s1', e.target.value)}>{MLABEL.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
          <button onClick={onCancel} className={`${btnCls} text-[#888] hover:text-white`}><X size={12} /></button>
          <button onClick={save} className={`${btnCls} bg-[#fafaf7] text-[#0b0b0c]`}><Check size={12} /></button>
        </div>
      </div>
    </div>
  );
}

export default function DCFarming({ dc = 'Hadrien' }) {
  const [clientsData, setClientsData] = useState({});
  const [clientList, setClientList] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragged, setDragged] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [editConcept, setEditConcept] = useState(null);
  const [editEvent, setEditEvent] = useState(null);
  const [trashConcepts, setTrashConcepts] = useState(false);
  const [trashEvents, setTrashEvents] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setClient(null);
    apiFetch(`/api/data/farming?dc=${encodeURIComponent(dc)}`)
      .then(d => {
        if (!alive) return;
        const cl = d.clients || {};
        setClientsData(cl);
        // Union : clients déjà travaillés (avec concepts/événements) + toutes les lignes clients + Biz Dev
        const withData = Object.keys(cl);
        const hasContent = (n) => { const x = cl[n]; return x && ((x.concepts || []).length || (x.events || []).length); };
        const options = d.clientOptions || [];
        const names = [...new Set([...withData, ...options])];
        // Ordre : clients déjà renseignés d'abord, puis le reste alphabétique
        names.sort((a, b) => (hasContent(b) ? 1 : 0) - (hasContent(a) ? 1 : 0) || a.localeCompare(b));
        setClientList(names);
        setClient(names[0] || null);
        setLoading(false);
      })
      .catch(e => { console.error('[Farming]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dc]);

  const persist = useCallback((clientName, data) => {
    setClientsData(prev => ({ ...prev, [clientName]: data }));
    apiFetch('/api/data/farming', { method: 'PUT', body: JSON.stringify({ dc, client: clientName, data }) })
      .catch(e => console.error('[Farming] save', e));
  }, [dc]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>;
  if (!client) return <p className="text-[#888] text-sm py-8 text-center">Aucune donnée farming pour ce DC.</p>;

  const d = clientsData[client] || { concepts: [], conceptsArchived: [], events: [], eventsArchived: [] };
  const accent = d.col || '#e63946';
  const concepts = d.concepts || [];
  const conceptsArchived = d.conceptsArchived || [];
  const events = d.events || [];
  const eventsArchived = d.eventsArchived || [];
  const up = (patch) => persist(client, { ...d, ...patch });

  const setConceptStatus = (id, status) => up({ concepts: concepts.map(c => c.id === id ? { ...c, status } : c) });
  const saveConceptEdit = (id, fields) => { up({ concepts: concepts.map(c => c.id === id ? { ...c, ...fields } : c) }); setEditConcept(null); };
  const addConcept = (fields) => { up({ concepts: [...concepts, { id: genId('c'), status: '', proven: false, ...fields }] }); setEditConcept(null); };
  const archiveConcept = (id) => { const c = concepts.find(x => x.id === id); if (c) up({ concepts: concepts.filter(x => x.id !== id), conceptsArchived: [{ ...c, archivedAt: nowISO() }, ...conceptsArchived] }); };
  const restoreConcept = (id) => { const c = conceptsArchived.find(x => x.id === id); if (c) { const { archivedAt, ...rest } = c; up({ concepts: [...concepts, rest], conceptsArchived: conceptsArchived.filter(x => x.id !== id) }); } };
  const deleteConcept = (id) => up({ conceptsArchived: conceptsArchived.filter(x => x.id !== id) });

  const saveEventEdit = (id, fields) => { up({ events: events.map(e => e.id === id ? { ...e, ...fields } : e) }); setEditEvent(null); };
  const addEvent = (fields) => { up({ events: [...events, { id: genId('e'), ...fields }] }); setEditEvent(null); };
  const archiveEvent = (id) => { const e = events.find(x => x.id === id); if (e) up({ events: events.filter(x => x.id !== id), eventsArchived: [{ ...e, archivedAt: nowISO() }, ...eventsArchived] }); };
  const restoreEvent = (id) => { const e = eventsArchived.find(x => x.id === id); if (e) { const { archivedAt, ...rest } = e; up({ events: [...events, rest], eventsArchived: eventsArchived.filter(x => x.id !== id) }); } };
  const deleteEvent = (id) => up({ eventsArchived: eventsArchived.filter(x => x.id !== id) });

  const handleDrop = (colKey) => { if (dragged) setConceptStatus(dragged, colKey); setDragged(null); setOverCol(null); };

  return (
    <div className="space-y-6">
      {/* Sélecteur de client — tous visibles (wrap, sans scroll) */}
      <div className="flex flex-wrap items-center gap-2">
        {clientList.map(name => {
          const on = name === client;
          const c = clientsData[name]?.col || '#666';
          return (
            <button key={name} onClick={() => { setClient(name); setEditConcept(null); setEditEvent(null); }}
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
          <div className="text-xl font-black italic text-white leading-none">{d.obj ? `${d.obj} K€` : '—'}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#666] mt-1">Objectif BP · MB {d.mb || '—'}</div>
        </div>
      </div>

      {/* ─── 1 · CONCEPT ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black italic" style={{ color: accent }}>1</span>
          <Lightbulb size={15} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Concept</h3>
          <button onClick={() => setEditConcept('NEW')} className={`${btnCls} ml-auto bg-[#161616] border border-[#2a2a2a] text-[#ccc] hover:text-white`}><Plus size={13} /> Concept</button>
        </div>

        {editConcept === 'NEW' && <div className="mb-3 max-w-md"><ConceptForm initial={{}} color={accent} onSave={addConcept} onCancel={() => setEditConcept(null)} /></div>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 items-start">
          {STATUS_COLS.map(col => {
            const items = concepts.filter(c => (c.status || '') === col.key);
            return (
              <div key={col.key} className="flex flex-col min-w-0">
                <div className={`text-[11px] font-black uppercase tracking-wide text-center py-2 rounded-t-md ${col.headCls}`}>{col.head} · {items.length}</div>
                <div onDragOver={e => { e.preventDefault(); setOverCol(col.key); }} onDragLeave={() => setOverCol(o => o === col.key ? null : o)} onDrop={() => handleDrop(col.key)}
                  className={`flex flex-col gap-2.5 p-2.5 rounded-b-md border border-t-0 border-[#2a2a2a] min-h-[90px] transition-colors ${overCol === col.key ? 'bg-[rgba(250,250,247,.07)]' : 'bg-[rgba(250,250,247,.02)]'}`}>
                  {items.length === 0
                    ? <div className="text-[#555] text-[10px] text-center py-5 uppercase tracking-wide font-bold">déposer ici</div>
                    : items.map(c => editConcept === c.id
                      ? <ConceptForm key={c.id} initial={c} color={accent} onSave={f => saveConceptEdit(c.id, f)} onCancel={() => setEditConcept(null)} />
                      : <ConceptCard key={c.id} concept={c} color={accent} onDragStart={() => setDragged(c.id)} onEdit={() => setEditConcept(c.id)} onArchive={() => archiveConcept(c.id)} />)}
                </div>
              </div>
            );
          })}
        </div>

        {conceptsArchived.length > 0 && (
          <div className="mt-3 border border-dashed border-[#2a2a2a] rounded-lg">
            <button onClick={() => setTrashConcepts(v => !v)} className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#888] hover:text-white">
              <Archive size={13} /> Concepts supprimés · {conceptsArchived.length} <span className="ml-auto text-[#555]">{trashConcepts ? '▲' : '▼'}</span>
            </button>
            {trashConcepts && (
              <div className="px-4 pb-3 space-y-1.5">
                {conceptsArchived.map(c => (
                  <div key={c.id} className="flex items-center gap-2 border-t border-[#1a1a1a] pt-1.5">
                    <span className="text-xs font-bold italic uppercase text-[#aaa] truncate">{c.name}</span>
                    <span className="text-[10px] text-[#555] truncate">{c.offer}</span>
                    <span className="ml-auto flex gap-2 shrink-0">
                      <button onClick={() => restoreConcept(c.id)} className={`${btnCls} text-[#5FC97A] hover:brightness-125`}><RotateCcw size={12} /> Restaurer</button>
                      <button onClick={() => deleteConcept(c.id)} className={`${btnCls} text-[#666] hover:text-[#EA5E7B]`}><Trash2 size={12} /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 2 · ÉVÉNEMENTS (avant la timeline) ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black italic" style={{ color: accent }}>2</span>
          <CalendarDays size={15} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Événements marque</h3>
          <button onClick={() => setEditEvent('NEW')} className={`${btnCls} ml-auto bg-[#161616] border border-[#2a2a2a] text-[#ccc] hover:text-white`}><Plus size={13} /> Événement</button>
        </div>

        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg px-4 py-1">
          {editEvent === 'NEW' && <EventForm initial={{}} onSave={addEvent} onCancel={() => setEditEvent(null)} />}
          {events.map(ev => editEvent === ev.id
            ? <EventForm key={ev.id} initial={ev} onSave={f => saveEventEdit(ev.id, f)} onCancel={() => setEditEvent(null)} />
            : (
              <div key={ev.id} className="group grid grid-cols-[140px_1fr] gap-3 py-3 border-t border-[#222] first:border-t-0">
                <div className="text-xs font-extrabold italic uppercase leading-tight" style={{ color: accent }}>{ev.date || '—'}</div>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white leading-snug">{ev.title}</div>
                    {ev.sub && <div className="text-xs text-[#888] mt-0.5 leading-relaxed">{ev.sub}</div>}
                  </div>
                  <span className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditEvent(ev.id)} title="Modifier" className="text-[#888] hover:text-white p-0.5"><Pencil size={13} /></button>
                    <button onClick={() => archiveEvent(ev.id)} title="Supprimer" className="text-[#888] hover:text-[#EA5E7B] p-0.5"><Trash2 size={13} /></button>
                  </span>
                </div>
              </div>
            ))}
          {events.length === 0 && editEvent !== 'NEW' && <p className="text-[#555] text-xs py-4 text-center">Aucun événement — clique « + Événement ».</p>}
        </div>

        {eventsArchived.length > 0 && (
          <div className="mt-3 border border-dashed border-[#2a2a2a] rounded-lg">
            <button onClick={() => setTrashEvents(v => !v)} className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#888] hover:text-white">
              <Archive size={13} /> Événements supprimés · {eventsArchived.length} <span className="ml-auto text-[#555]">{trashEvents ? '▲' : '▼'}</span>
            </button>
            {trashEvents && (
              <div className="px-4 pb-3 space-y-1.5">
                {eventsArchived.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 border-t border-[#1a1a1a] pt-1.5">
                    <span className="text-[10px] font-bold italic uppercase text-[#777] shrink-0">{ev.date}</span>
                    <span className="text-xs text-[#aaa] truncate">{ev.title}</span>
                    <span className="ml-auto flex gap-2 shrink-0">
                      <button onClick={() => restoreEvent(ev.id)} className={`${btnCls} text-[#5FC97A] hover:brightness-125`}><RotateCcw size={12} /> Restaurer</button>
                      <button onClick={() => deleteEvent(ev.id)} className={`${btnCls} text-[#666] hover:text-[#EA5E7B]`}><Trash2 size={12} /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 3 · TIMELINE (Gantt, en dernier) ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black italic" style={{ color: accent }}>3</span>
          <GanttChartSquare size={15} className="text-[#888]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Timeline — saison 26/27</h3>
        </div>
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 overflow-x-auto">
          <div style={{ minWidth: 920 }}>
            <div className="grid border-b border-[#2a2a2a] mb-1" style={{ gridTemplateColumns: GRID }}>
              <div />
              {MONTHS.map((m, i) => <div key={i} className={`text-[8px] font-bold uppercase text-center py-1 border-l border-[#222] ${i === 0 || i === 12 ? 'text-white' : 'text-[#666]'}`}>{m}</div>)}
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider py-2" style={{ color: accent }}>◇ Événements marque ({events.length})</div>
            {events.map(ev => <GanttRow key={ev.id} label={ev.title} sub marker="◇" span={ev.span} color={accent} filled={false} />)}
            <div className="text-[10px] font-black uppercase tracking-wider py-2 mt-1" style={{ color: accent }}>● Concepts SPK ({concepts.length})</div>
            {concepts.map(c => <GanttRow key={c.id} label={c.name} sub marker="●" span={c.span} color={accent} filled={true} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
