import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Calendar, FileSearch, FileText, TrendingUp, Briefcase, Save, ChevronRight, Target, Crosshair } from 'lucide-react';
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

function funnelOf(portfolio, entry) {
  const k = portfolio?.kpis || {};
  return {
    leads: entry?.leads || 0,
    rdv: entry?.rdv || 0,
    briefs: entry?.briefs || 0,
    devis: portfolio?.proposals?.length || 0,
    pipe: Math.round(k.pipelineProbabilise || 0),
    ca: Math.round(k.caTotal || 0),
  };
}

const ratio = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

function FunnelBand({ data }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const val = data[s.key];
        const next = STAGES[i + 1];
        const showConv = next && i < 3;
        const conv = showConv ? ratio(data[next.key], val) : null;
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
                <span className="text-[11px] font-bold" style={{ color: conv == null ? '#444' : conv >= 50 ? '#2ecc71' : conv >= 25 ? '#f39c12' : '#e74c3c' }}>
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

function SaisieHebdo({ dcNames, currentWeek, entries, onSaved }) {
  const [dc, setDc] = useState(dcNames[0] || '');
  const [form, setForm] = useState({ leads: 0, rdv: 0, briefs: 0, note: '' });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const e = entries?.[dc]?.[currentWeek];
    setForm({ leads: e?.leads || 0, rdv: e?.rdv || 0, briefs: e?.briefs || 0, note: e?.note || '' });
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
    { k: 'leads', label: 'Leads générés', icon: Users },
    { k: 'rdv', label: 'RDV réalisés', icon: Calendar },
    { k: 'briefs', label: 'Briefs détectés', icon: FileSearch },
  ];

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-white font-extrabold italic text-lg">Saisie hebdo</h3>
          <p className="text-[#888] text-xs">Semaine {currentWeek} · le bas du funnel est déjà rempli par Furious</p>
        </div>
        <select value={dc} onChange={e => setDc(e.target.value)}
          className="bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm rounded-lg px-3 py-2">
          {dcNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {fields.map(f => {
          const Icon = f.icon;
          return (
            <label key={f.k} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[#888] text-xs font-semibold uppercase tracking-wide">
                <Icon size={14} /> {f.label}
              </span>
              <input type="number" min="0" value={form[f.k]}
                onChange={e => set(f.k, e.target.value)}
                className="bg-transparent text-white text-2xl font-extrabold italic w-full outline-none" />
            </label>
          );
        })}
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
        <FunnelBand data={teamFunnel} />
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
