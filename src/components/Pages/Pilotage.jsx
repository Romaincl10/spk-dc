import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Calendar, FileSearch, FileText, TrendingUp, Briefcase, Save, ChevronRight, Activity as ActivityIcon } from 'lucide-react';
import KPICard from '../Common/KPICard';
import { apiFetch } from '../../utils/api';

const DC_COLORS = {
  'Audrey': '#e63946', 'Hadrien': '#3b82f6', 'Ninon': '#2ecc71', 'Clément': '#f39c12',
  'Naël': '#0ea5e9', 'Alizée': '#ec4899', 'Paul': '#8b5cf6', 'A assigner': '#666',
};
const FALLBACK = ['#e63946', '#3b82f6', '#2ecc71', '#f39c12', '#8b5cf6', '#ec4899', '#0ea5e9'];
const colorFor = (name, i = 0) => DC_COLORS[name] || FALLBACK[i % FALLBACK.length];

const eur = (v) => {
  const n = Math.round(v || 0);
  if (Math.abs(n) >= 1000000) return (n / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M€';
  if (Math.abs(n) >= 1000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' K€';
  return n.toLocaleString('fr-FR') + ' €';
};

// Étapes du funnel — 3 saisies amont (hors Furious) + 3 issues de Furious
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

/** Bande funnel : 6 étapes + taux de passage sur le haut de funnel */
function FunnelBand({ data }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const val = data[s.key];
        const next = STAGES[i + 1];
        // taux de passage uniquement entre volumes comparables (leads→rdv→briefs→devis)
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

/** Formulaire de saisie hebdo « 30 secondes » */
function SaisieHebdo({ isAdmin, dcNames, currentWeek, entries, onSaved }) {
  const [dc, setDc] = useState(dcNames[0] || '');
  const [form, setForm] = useState({ leads: 0, rdv: 0, briefs: 0, note: '' });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  // Pré-remplit depuis la saisie existante de la semaine
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
        body: JSON.stringify({ ...(isAdmin ? { dc } : {}), week: currentWeek, ...form }),
      });
      setOk(true);
      onSaved && onSaved();
    } catch (e) { console.error('[Pilotage] save error', e); }
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
        {isAdmin && (
          <select value={dc} onChange={e => setDc(e.target.value)}
            className="bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm rounded-lg px-3 py-2">
            {dcNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
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

export default function Pilotage({ portfolios, user }) {
  const isAdmin = user?.role === 'admin';
  const [activity, setActivity] = useState({});
  const [currentWeek, setCurrentWeek] = useState('');
  const [pipeSnapshot, setPipeSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      const a = await apiFetch('/api/data/activity');
      setActivity(a?.activity || {});
      setCurrentWeek(a?.currentWeek || '');
    } catch (e) { console.error('[Pilotage] activity load', e); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadActivity();
      if (isAdmin) {
        try { const p = await apiFetch('/api/data/pipe-stages'); setPipeSnapshot(p?.snapshot || null); }
        catch (e) { console.error('[Pilotage] pipe-stages', e); }
      }
      setLoading(false);
    })();
  }, [loadActivity, isAdmin]);

  const dcNames = useMemo(() => {
    if (!portfolios) return [];
    return Object.keys(portfolios).filter(n => n !== 'A assigner').sort();
  }, [portfolios]);

  // Funnel affiché : global (admin) ou portefeuille du DC connecté
  const { headerFunnel, headerLabel } = useMemo(() => {
    if (!portfolios) return { headerFunnel: null, headerLabel: '' };
    if (isAdmin) {
      const agg = { leads: 0, rdv: 0, briefs: 0, devis: 0, pipe: 0, ca: 0 };
      dcNames.forEach(n => {
        const f = funnelOf(portfolios[n], activity?.[n]?.[currentWeek]);
        agg.leads += f.leads; agg.rdv += f.rdv; agg.briefs += f.briefs;
        agg.devis += f.devis; agg.pipe += f.pipe; agg.ca += f.ca;
      });
      return { headerFunnel: agg, headerLabel: 'Équipe — funnel consolidé' };
    }
    const myName = user?.furiousName || user?.name;
    const key = portfolios[myName] ? myName : Object.keys(portfolios)[0];
    return { headerFunnel: funnelOf(portfolios[key], activity?.[key]?.[currentWeek]), headerLabel: `Mon funnel — ${key}` };
  }, [portfolios, activity, currentWeek, isAdmin, dcNames, user]);

  if (loading || !portfolios) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#e63946]/15 flex items-center justify-center">
          <ActivityIcon size={18} className="text-[#e63946]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold italic text-white">Pilotage commercial</h1>
          <p className="text-[#888] text-sm">Du lead à la signature — indicateurs communs à tous les profils business</p>
        </div>
      </div>

      {/* Funnel principal */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-white font-bold">{headerLabel}</h2>
          <span className="text-[#888] text-xs">
            <span className="text-[#f39c12] font-semibold">Saisi</span> = capté chaque semaine ·{' '}
            <span className="text-[#2ecc71] font-semibold">Furious</span> = automatique
          </span>
        </div>
        {headerFunnel && <FunnelBand data={headerFunnel} />}
        <p className="text-[#555] text-[11px] mt-3">
          Les % sont les taux de passage de la semaine {currentWeek} (indicatifs tant que la saisie n'est pas généralisée).
        </p>
      </div>

      {/* Saisie hebdo */}
      <SaisieHebdo
        isAdmin={isAdmin}
        dcNames={isAdmin ? dcNames : [user?.furiousName || user?.name]}
        currentWeek={currentWeek}
        entries={activity}
        onSaved={loadActivity}
      />

      {/* Tableau cross-DC (admin) */}
      {isAdmin && (
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
            </tbody>
          </table>
          <p className="text-[#555] text-[11px] mt-3">
            Leads / RDV / Briefs = saisie hebdo · Devis / Pipe / CA = Furious (exercice en cours).
          </p>
        </div>
      )}

      {/* Pipe réel issu du dernier snapshot (admin) */}
      {isAdmin && pipeSnapshot?.byStatus?.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-white font-extrabold italic text-lg">Pipe Furious par statut</h3>
            <span className="text-[#888] text-xs">Snapshot du {pipeSnapshot.date}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pipeSnapshot.byStatus.map(s => (
              <KPICard key={s.statut} label={s.statut} value={Math.round(s.caPond)} suffix="€"
                subtitle={`${s.n} devis`} />
            ))}
          </div>
          <p className="text-[#555] text-[11px] mt-3">
            « Brief en attente » côté Furious = briefs déjà chiffrés ; la colonne Briefs ci-dessus capte ceux détectés <em>avant</em> chiffrage.
          </p>
        </div>
      )}
    </div>
  );
}
