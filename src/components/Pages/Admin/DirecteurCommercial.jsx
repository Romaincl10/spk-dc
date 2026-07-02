import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Calendar, FileSearch, FileText, TrendingUp, Briefcase, Save, ChevronRight, Target, Crosshair, Building2, User, X, Plus } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import { apiFetch } from '../../../utils/api';

const DC_COLORS = {
  'Audrey': '#e63946', 'Hadrien': '#3b82f6', 'Ninon': '#2ecc71', 'Clément': '#f39c12',
  'Naël': '#0ea5e9', 'Alizée': '#ec4899', 'Paul': '#8b5cf6', 'A assigner': '#666',
};
const FALLBACK = ['#e63946', '#3b82f6', '#2ecc71', '#f39c12', '#8b5cf6', '#ec4899', '#0ea5e9'];
const colorFor = (name, i = 0) => DC_COLORS[name] || FALLBACK[i % FALLBACK.length];

const OFFER_COLORS = {
  BRAND: '#e63946', EVENT: '#3b82f6', CONTENUS: '#2ecc71', INFLUENCE: '#f39c12', MEDIAS: '#8b5cf6',
};

const eur = (v) => {
  const n = Math.round(v || 0);
  if (Math.abs(n) >= 1000000) return (n / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M€';
  if (Math.abs(n) >= 1000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' K€';
  return n.toLocaleString('fr-FR') + ' €';
};

const STAGES = [
  { key: 'leads', label: 'Leads', icon: Users, src: 'saisi' },
  { key: 'rdv', label: 'RDV réalisés', icon: Calendar, src: 'saisi' },
  { key: 'briefs', label: 'Briefs détectés', icon: FileSearch, src: 'saisi' },
  { key: 'devis', label: 'Opportunités', icon: FileText, src: 'furious', sub: 'devis ouverts' },
  { key: 'pipe', label: 'Pipe pondéré', icon: TrendingUp, src: 'furious', money: true },
  { key: 'ca', label: 'CA signé', icon: Briefcase, src: 'furious', money: true },
];

// Compte un indicateur qu'il soit une liste d'items {label,kind} (nouveau) ou un nombre (ancien format)
const cnt = (v) => (Array.isArray(v) ? v.length : Number(v) || 0);
const asItems = (v) => (Array.isArray(v) ? v : []);

function funnelOf(portfolio, entry) {
  const k = portfolio?.kpis || {};
  return {
    leads: cnt(entry?.leads),
    rdv: cnt(entry?.rdv),
    briefs: cnt(entry?.briefs),
    devis: portfolio?.proposals?.length || 0,
    pipe: Math.round(k.pipelineProbabilise || 0),
    ca: Math.round(k.caTotal || 0),
  };
}

const ratio = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

const convColor = (c) => (c == null ? '#555' : c >= 60 ? '#2ecc71' : c >= 30 ? '#f39c12' : '#e74c3c');

/** Graphique en entonnoir — bandes trapézoïdales dégradées, ombrées + pastilles de taux de passage */
function FunnelChart({ data }) {
  const CX = 250, H = 54, GAP = 10, TOP = 30;
  const TH = [210, 182, 154, 126, 98, 70]; // demi-largeur haute par bande
  const BH = [188, 160, 132, 104, 76, 48]; // demi-largeur basse par bande
  return (
    <svg viewBox="0 0 760 434" role="img" className="w-full h-auto" style={{ maxWidth: 760 }}
      fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
      <title>Funnel commercial de l'équipe</title>
      <defs>
        <linearGradient id="fSaisi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7b733" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="fFurious" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3fe0a3" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <filter id="fShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      {STAGES.map((s, i) => {
        const yTop = TOP + i * (H + GAP), yBot = yTop + H, cy = yTop + H / 2;
        const grad = s.src === 'saisi' ? 'url(#fSaisi)' : 'url(#fFurious)';
        const color = s.src === 'saisi' ? '#f39c12' : '#2ecc71';
        const val = data[s.key];
        const pts = `${CX - TH[i]},${yTop} ${CX + TH[i]},${yTop} ${CX + BH[i]},${yBot} ${CX - BH[i]},${yBot}`;
        return (
          <g key={s.key}>
            <polygon points={pts} fill={grad} filter="url(#fShadow)" stroke="#ffffff" strokeOpacity="0.12" />
            <text x={CX} y={cy + 8} textAnchor="middle" fill="#fff" fontSize="23" fontWeight="800" fontStyle="italic"
              style={{ paintOrder: 'stroke' }} stroke="#000" strokeOpacity="0.25" strokeWidth="0.6">
              {s.money ? eur(val) : val.toLocaleString('fr-FR')}
            </text>
            {/* Libellé + badge source à droite */}
            <text x="524" y={cy - 2} fill="#fff" fontSize="14" fontWeight="700">{s.label}</text>
            <rect x="524" y={cy + 5} width="62" height="18" rx="9" fill={color} fillOpacity="0.18" />
            <text x="555" y={cy + 17} textAnchor="middle" fontSize="9.5" fontWeight="800" fill={color} letterSpacing="0.6">
              {s.src === 'saisi' ? 'SAISI' : 'FURIOUS'}
            </text>
            {s.sub && <text x="594" y={cy + 18} fontSize="10.5" fill="#888">{s.sub}</text>}
          </g>
        );
      })}

      {/* Pastilles de taux de passage entre les étapes hautes */}
      {[0, 1, 2].map((i) => {
        const yB = TOP + i * (H + GAP) + H + GAP / 2;
        const conv = ratio(data[STAGES[i + 1].key], data[STAGES[i].key]);
        const c = convColor(conv);
        return (
          <g key={`conv-${i}`}>
            <circle cx={CX} cy={yB} r="18" fill="#0d0d0d" stroke={c} strokeWidth="2" filter="url(#fShadow)" />
            <text x={CX} y={yB + 4} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={c}>
              {conv == null ? '—' : `${conv}%`}
            </text>
          </g>
        );
      })}

      {/* Légende */}
      <rect x="150" y="416" width="12" height="12" rx="3" fill="url(#fSaisi)" />
      <text x="168" y="426" fontSize="11" fill="#aaa">Saisi — capté chaque semaine (hors Furious)</text>
      <rect x="470" y="416" width="12" height="12" rx="3" fill="url(#fFurious)" />
      <text x="488" y="426" fontSize="11" fill="#aaa">Furious — automatique</text>
    </svg>
  );
}

/** Rangée de cartes détaillées (complément chiffré du graphique) */
function FunnelBand({ data }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const val = data[s.key];
        const showConv = i < 3;
        const conv = showConv ? ratio(data[STAGES[i + 1].key], val) : null;
        return (
          <div key={s.key} className="flex items-stretch gap-2">
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-3 md:p-4 w-[140px] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <Icon size={15} className="text-[#888]" />
                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.src === 'saisi' ? 'bg-[#f39c12]/15 text-[#f39c12]' : 'bg-[#2ecc71]/15 text-[#2ecc71]'}`}>
                  {s.src === 'saisi' ? 'Saisi' : 'Furious'}
                </span>
              </div>
              <div className="text-xl md:text-2xl font-extrabold italic text-white leading-none">
                {s.money ? eur(val) : val.toLocaleString('fr-FR')}
              </div>
              <div className="text-[#888] text-[11px] mt-1 font-medium">{s.label}{s.sub ? ` · ${s.sub}` : ''}</div>
            </div>
            {showConv && (
              <div className="hidden md:flex flex-col items-center justify-center w-12 text-center">
                <ChevronRight size={16} className="text-[#444]" />
                <span className="text-[11px] font-bold" style={{ color: convColor(conv) }}>
                  {conv == null ? '—' : `${conv}%`}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Éditeur d'une catégorie (leads / RDV / briefs) : liste d'items nominatifs personne ou société */
function ItemEditor({ label, icon: Icon, accent, items, onChange }) {
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState('societe');

  const add = () => {
    const l = draft.trim();
    if (!l) return;
    onChange([...items, { label: l, kind }]);
    setDraft('');
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-[#888] text-xs font-semibold uppercase tracking-wide">
          <Icon size={14} /> {label}
        </span>
        <span className="text-sm font-extrabold italic" style={{ color: accent }}>{items.length}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
        {items.map((it, i) => {
          const K = it.kind === 'personne' ? User : Building2;
          return (
            <span key={i} className="group flex items-center gap-1 bg-[#161616] border border-[#2a2a2a] rounded-md pl-1.5 pr-1 py-0.5 text-xs text-white">
              <K size={11} className="text-[#888]" />
              <span className="max-w-[130px] truncate">{it.label}</span>
              <button onClick={() => remove(i)} className="text-[#666] hover:text-[#e63946]"><X size={12} /></button>
            </span>
          );
        })}
        {items.length === 0 && <span className="text-[#555] text-[11px] italic">Aucun — ajoute une personne ou une société</span>}
      </div>

      <div className="flex items-center gap-1 mt-auto">
        <div className="flex bg-[#161616] border border-[#2a2a2a] rounded-md overflow-hidden shrink-0">
          <button onClick={() => setKind('societe')} title="Société"
            className={`p-1.5 ${kind === 'societe' ? 'bg-[#2a2a2a] text-white' : 'text-[#666]'}`}><Building2 size={13} /></button>
          <button onClick={() => setKind('personne')} title="Personne"
            className={`p-1.5 ${kind === 'personne' ? 'bg-[#2a2a2a] text-white' : 'text-[#666]'}`}><User size={13} /></button>
        </div>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={kind === 'personne' ? 'Nom de la personne' : 'Nom de la société'}
          className="flex-1 min-w-0 bg-[#161616] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-sm text-white outline-none focus:border-[#e63946]" />
        <button onClick={add} className="shrink-0 bg-[#2a2a2a] hover:bg-[#e63946] text-white rounded-md p-1.5"><Plus size={15} /></button>
      </div>
    </div>
  );
}

function SaisieHebdo({ dcNames, currentWeek, entries, onSaved }) {
  const [dc, setDc] = useState(dcNames[0] || '');
  const [form, setForm] = useState({ leads: [], rdv: [], briefs: [], note: '' });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const e = entries?.[dc]?.[currentWeek];
    setForm({ leads: asItems(e?.leads), rdv: asItems(e?.rdv), briefs: asItems(e?.briefs), note: e?.note || '' });
    setOk(false);
  }, [dc, currentWeek, entries]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setOk(false);
    try {
      await apiFetch('/api/data/activity', {
        method: 'PUT',
        body: JSON.stringify({ dc, week: currentWeek, ...form }),
      });
      setOk(true);
      onSaved && onSaved();
    } catch (e) { console.error('[DirecteurCommercial] save error', e); }
    setSaving(false);
  };

  const fields = [
    { k: 'leads', label: 'Leads générés', icon: Users, accent: '#f39c12' },
    { k: 'rdv', label: 'RDV réalisés', icon: Calendar, accent: '#f39c12' },
    { k: 'briefs', label: 'Briefs détectés', icon: FileSearch, accent: '#f39c12' },
  ];

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-white font-extrabold italic text-lg">Saisie hebdo</h3>
          <p className="text-[#888] text-xs">Semaine {currentWeek} · chaque lead / RDV / brief est nominatif (société ou personne)</p>
        </div>
        <select value={dc} onChange={e => setDc(e.target.value)}
          className="bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm rounded-lg px-3 py-2">
          {dcNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {fields.map(f => (
          <ItemEditor key={f.k} label={f.label} icon={f.icon} accent={f.accent}
            items={form[f.k]} onChange={v => set(f.k, v)} />
        ))}
      </div>

      <textarea value={form.note} onChange={e => set('note', e.target.value)}
        placeholder="Note de la semaine (optionnel) — temps fort, signal, blocage…"
        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-sm text-white outline-none resize-none h-16 mb-3" />

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || !dc}
          className="flex items-center gap-2 bg-[#e63946] hover:bg-[#d62839] disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer la semaine'}
        </button>
        {ok && <span className="text-[#2ecc71] text-sm font-semibold">✓ Enregistré</span>}
      </div>
    </div>
  );
}

export default function DirecteurCommercial({ portfolios }) {
  const [activity, setActivity] = useState({});
  const [currentWeek, setCurrentWeek] = useState('');
  const [pipeSnapshot, setPipeSnapshot] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [prospectsTotal, setProspectsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      const a = await apiFetch('/api/data/activity');
      setActivity(a?.activity || {});
      setCurrentWeek(a?.currentWeek || '');
    } catch (e) { console.error('[DirecteurCommercial] activity', e); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadActivity();
      try { const p = await apiFetch('/api/data/pipe-stages'); setPipeSnapshot(p?.snapshot || null); }
      catch (e) { console.error('[DirecteurCommercial] pipe-stages', e); }
      try {
        const dp = await apiFetch('/api/data/director-prospects');
        setProspects(dp?.prospects || []);
        setProspectsTotal(dp?.total || 0);
      } catch (e) { console.error('[DirecteurCommercial] prospects', e); }
      setLoading(false);
    })();
  }, [loadActivity]);

  const dcNames = useMemo(() => {
    if (!portfolios) return [];
    return Object.keys(portfolios).filter(n => n !== 'A assigner' && n !== 'Paul').sort();
  }, [portfolios]);

  const teamFunnel = useMemo(() => {
    const agg = { leads: 0, rdv: 0, briefs: 0, devis: 0, pipe: 0, ca: 0 };
    dcNames.forEach(n => {
      const f = funnelOf(portfolios[n], activity?.[n]?.[currentWeek]);
      agg.leads += f.leads; agg.rdv += f.rdv; agg.briefs += f.briefs;
      agg.devis += f.devis; agg.pipe += f.pipe; agg.ca += f.ca;
    });
    return agg;
  }, [portfolios, activity, currentWeek, dcNames]);

  const sortedProspects = useMemo(
    () => [...prospects].sort((a, b) => (b.objectif || 0) - (a.objectif || 0)),
    [prospects]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center">
          <Crosshair size={20} className="text-[#8b5cf6]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Paul — Directeur commercial</h2>
          <p className="text-[#888] text-sm">Pilotage de l'activité équipe + portefeuille de prospects à conquérir</p>
        </div>
      </div>

      {/* Funnel équipe consolidé */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-white font-bold">Funnel équipe — semaine {currentWeek}</h3>
          <span className="text-[#888] text-xs">
            <span className="text-[#f39c12] font-semibold">Saisi</span> = capté chaque semaine ·{' '}
            <span className="text-[#2ecc71] font-semibold">Furious</span> = automatique
          </span>
        </div>
        <FunnelChart data={teamFunnel} />

        {/* Rangée de cartes détaillées, en complément du graphique */}
        <div className="mt-5 pt-5 border-t border-[#2a2a2a] overflow-x-auto">
          <FunnelBand data={teamFunnel} />
        </div>

        <p className="text-[#555] text-[11px] mt-3">
          Taux de passage de la semaine (indicatifs tant que la saisie hebdo n'est pas généralisée à toute l'équipe).
        </p>
      </div>

      {/* Saisie hebdo (le directeur peut saisir pour chaque DC) */}
      <SaisieHebdo dcNames={dcNames} currentWeek={currentWeek} entries={activity} onSaved={loadActivity} />

      {/* Contribution par DC */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5 overflow-x-auto">
        <h3 className="text-white font-extrabold italic text-lg mb-4">Contribution par DC — semaine {currentWeek}</h3>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-[#888] text-xs uppercase tracking-wide border-b border-[#2a2a2a]">
              <th className="text-left font-semibold py-2 pr-4">DC</th>
              <th className="text-right font-semibold py-2 px-2">Leads</th>
              <th className="text-right font-semibold py-2 px-2">RDV</th>
              <th className="text-right font-semibold py-2 px-2">Briefs</th>
              <th className="text-right font-semibold py-2 px-2">Devis</th>
              <th className="text-right font-semibold py-2 px-2">Pipe pondéré</th>
              <th className="text-right font-semibold py-2 pl-2">CA signé</th>
            </tr>
          </thead>
          <tbody>
            {dcNames.map((n, i) => {
              const f = funnelOf(portfolios[n], activity?.[n]?.[currentWeek]);
              return (
                <tr key={n} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2 font-semibold text-white">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(n, i) }} />
                      {n}
                    </span>
                  </td>
                  <td className="text-right py-2.5 px-2 text-white">{f.leads}</td>
                  <td className="text-right py-2.5 px-2 text-white">{f.rdv}</td>
                  <td className="text-right py-2.5 px-2 text-white">{f.briefs}</td>
                  <td className="text-right py-2.5 px-2 text-white">{f.devis}</td>
                  <td className="text-right py-2.5 px-2 font-semibold text-white">{eur(f.pipe)}</td>
                  <td className="text-right py-2.5 pl-2 font-semibold text-white">{eur(f.ca)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-[#e63946]/30 bg-[#e63946]/5 font-bold">
              <td className="py-2.5 pr-4 text-white">TOTAL</td>
              <td className="text-right py-2.5 px-2 text-white">{teamFunnel.leads}</td>
              <td className="text-right py-2.5 px-2 text-white">{teamFunnel.rdv}</td>
              <td className="text-right py-2.5 px-2 text-white">{teamFunnel.briefs}</td>
              <td className="text-right py-2.5 px-2 text-white">{teamFunnel.devis}</td>
              <td className="text-right py-2.5 px-2 text-white">{eur(teamFunnel.pipe)}</td>
              <td className="text-right py-2.5 pl-2 text-white">{eur(teamFunnel.ca)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[#555] text-[11px] mt-3">
          Leads / RDV / Briefs = saisie hebdo · Devis / Pipe / CA = Furious (exercice en cours).
        </p>
      </div>

      {/* Détail nominatif de la semaine */}
      {dcNames.some(n => { const e = activity?.[n]?.[currentWeek]; return e && (asItems(e.leads).length + asItems(e.rdv).length + asItems(e.briefs).length) > 0; }) && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
          <h3 className="text-white font-extrabold italic text-lg mb-4">Détail nominatif — semaine {currentWeek}</h3>
          <div className="space-y-3">
            {dcNames.map((n, i) => {
              const e = activity?.[n]?.[currentWeek];
              const groups = [
                { key: 'leads', label: 'Leads', items: asItems(e?.leads) },
                { key: 'rdv', label: 'RDV', items: asItems(e?.rdv) },
                { key: 'briefs', label: 'Briefs', items: asItems(e?.briefs) },
              ];
              if (!groups.reduce((s, g) => s + g.items.length, 0)) return null;
              return (
                <div key={n} className="border-b border-[#1a1a1a] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(n, i) }} />
                    <span className="font-semibold text-white text-sm">{n}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {groups.map(g => (
                      <div key={g.key}>
                        <div className="text-[#888] text-[11px] font-semibold uppercase mb-1">{g.label} ({g.items.length})</div>
                        <div className="flex flex-wrap gap-1">
                          {g.items.length ? g.items.map((it, idx) => {
                            const K = it.kind === 'personne' ? User : Building2;
                            return (
                              <span key={idx} className="flex items-center gap-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-1.5 py-0.5 text-xs text-[#ccc]">
                                <K size={10} className="text-[#666]" />{it.label}
                              </span>
                            );
                          }) : <span className="text-[#555] text-[11px]">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipe Furious par statut */}
      {pipeSnapshot?.byStatus?.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-white font-extrabold italic text-lg">Pipe Furious par statut</h3>
            <span className="text-[#888] text-xs">Snapshot du {pipeSnapshot.date}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pipeSnapshot.byStatus.map(s => (
              <KPICard key={s.statut} label={s.statut} value={Math.round(s.caPond)} suffix="€" subtitle={`${s.n} devis`} />
            ))}
          </div>
        </div>
      )}

      {/* Portefeuille prospects — objectifs par prospect */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-[#8b5cf6]" />
          <h3 className="text-white font-extrabold italic text-lg">Portefeuille prospects — objectifs</h3>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <KPICard label="Prospects ciblés" value={prospects.length} />
          <KPICard label="Objectif total" value={prospectsTotal} suffix="€" color="text-[#8b5cf6]" />
          <KPICard label="Objectif moyen" value={prospects.length ? Math.round(prospectsTotal / prospects.length) : 0} suffix="€" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[#888] text-xs uppercase tracking-wide border-b border-[#2a2a2a]">
                <th className="text-left font-semibold py-2 pr-3">Prospect</th>
                <th className="text-left font-semibold py-2 px-2">Pays</th>
                <th className="text-right font-semibold py-2 px-2">Budget marque</th>
                <th className="text-left font-semibold py-2 px-2">Vertical</th>
                <th className="text-left font-semibold py-2 px-2">Offres SPK</th>
                <th className="text-right font-semibold py-2 pl-2">Objectif SPK</th>
              </tr>
            </thead>
            <tbody>
              {sortedProspects.map((p) => (
                <tr key={p.name} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-[#666] text-[11px]">{p.note}</div>
                  </td>
                  <td className="py-2.5 px-2 text-[#ccc]">{p.country}</td>
                  <td className="py-2.5 px-2 text-right text-[#ccc]">{(p.budgetK || 0).toLocaleString('fr-FR')} K€</td>
                  <td className="py-2.5 px-2 text-[#ccc]">{p.vertical}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-1">
                      {(p.offers || []).map(o => (
                        <span key={o} className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${OFFER_COLORS[o] || '#666'}22`, color: OFFER_COLORS[o] || '#999' }}>
                          {o}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pl-2 text-right font-bold text-white">{eur(p.objectif)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#8b5cf6]/40 bg-[#8b5cf6]/5 font-bold">
                <td className="py-2.5 pr-3 text-white" colSpan={5}>TOTAL OBJECTIF PORTEFEUILLE</td>
                <td className="py-2.5 pl-2 text-right text-[#8b5cf6]">{prospectsTotal.toLocaleString('fr-FR')} €</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
