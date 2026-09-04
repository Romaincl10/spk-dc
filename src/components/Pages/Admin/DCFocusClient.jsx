import { useMemo, useState, useEffect } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import ChartWrapper from '../../Common/ChartWrapper';
import ProgressBar from '../../Common/ProgressBar';
import { fmtK, fmtPct, fmtNum } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function DCFocusClient({ portfolio, color, openClient }) {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  const fyProjects = (portfolio.projects || []).filter(p => p.inFY);
  const clientBreakdown = portfolio.clientBreakdown || [];

  // Ouverture d'un client depuis l'extérieur (Heatmap) : match exact puis approché
  useEffect(() => {
    if (!openClient?.name) return;
    const t = norm(openClient.name);
    const exact = clientBreakdown.find(c => norm(c.name) === t);
    const approx = exact || clientBreakdown.find(c => { const n = norm(c.name); return n.includes(t) || t.includes(n); });
    if (approx) { setSelectedClient(approx.name); setSearch(''); }
    else setSearch(openClient.name);
  }, [openClient?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Objectif par client (via les noms canoniques rattachés à chaque objectif)
  const objByClient = useMemo(() => {
    const m = {};
    (portfolio.objectives || []).forEach(o => {
      if (o.client === '_BIZ_DEV' || !(o.target > 0)) return;
      (o.canonicalNames && o.canonicalNames.length ? o.canonicalNames : [o.client]).forEach(n => { m[n] = (m[n] || 0) + o.target; });
    });
    return m;
  }, [portfolio.objectives]);

  const filtered = useMemo(() => {
    if (!search) return clientBreakdown;
    const s = search.toLowerCase();
    return clientBreakdown.filter(c => c.name.toLowerCase().includes(s));
  }, [clientBreakdown, search]);

  const clientDetail = useMemo(() => {
    if (!selectedClient) return null;
    const client = clientBreakdown.find(c => c.name === selectedClient);
    if (!client) return null;

    const projects = fyProjects.filter(p => (p.canonical_client || p.company_name) === selectedClient);
    const active = projects.filter(p => p.actif === '1' || p.actif === 1);
    const totalSold = projects.reduce((s, p) => s + p.time_sold_days, 0);
    const totalSpent = projects.reduce((s, p) => s + p.time_spent_days, 0);
    const totalPlanified = projects.reduce((s, p) => s + p.time_planified_days, 0);

    // Current month key
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Monthly jours from sprint data (monthlyDays per project)
    const monthlyJours = {};
    projects.forEach(p => {
      const md = p.monthlyDays || {};
      Object.entries(md).forEach(([month, data]) => {
        if (!monthlyJours[month]) monthlyJours[month] = { fait: 0, planifie: 0 };
        monthlyJours[month].fait += data.fait;
        monthlyJours[month].planifie += data.planifie;
      });
    });

    // Monthly CA from invoice dates: past = facturé (invoice_date <= today), future = planifié (invoice_date > today, within FY)
    const monthlyCAInvoice = client.monthlyInvoiceCA || {};
    const monthlyCAInvoicePlan = client.monthlyInvoicePlan || {};

    // All FY months
    const allMonths = [];
    for (let m = 6; m < 18; m++) {
      const y = m < 12 ? 2025 : 2026;
      const mo = m % 12;
      const key = `${y}-${String(mo + 1).padStart(2, '0')}`;
      const label = new Date(y, mo).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const isCurrent = key === currentMonthKey;
      allMonths.push({
        month: key, label, isCurrent,
        fait: Math.round((monthlyJours[key]?.fait || 0) * 10) / 10,
        planifie: Math.round((monthlyJours[key]?.planifie || 0) * 10) / 10,
        ca: Math.round(monthlyCAInvoice[key] || 0),
        caPlan: Math.round(monthlyCAInvoicePlan[key] || 0),
      });
    }

    const avancementFait = totalSold > 0 ? Math.round(totalSpent / totalSold * 100) : 0;
    const avancementTotal = totalSold > 0 ? Math.round((totalSpent + totalPlanified) / totalSold * 100) : 0;

    const isActive = p => p.actif === '1' || p.actif === 1;
    return {
      ...client,
      // Projets en cours (actifs) remontés en priorité, puis par CA décroissant
      projects: [...projects].sort((a, b) => {
        const aa = isActive(a) ? 1 : 0, bb = isActive(b) ? 1 : 0;
        if (aa !== bb) return bb - aa;
        return b.total_amount - a.total_amount;
      }),
      active,
      totalSold, totalSpent, totalPlanified,
      avancementFait, avancementTotal,
      monthlyData: allMonths,
      currentMonthKey,
      mbPct: client.ca > 0 ? Math.round(client.mb / client.ca * 1000) / 10 : 0,
      devis: client.devis || [],
    };
  }, [selectedClient, fyProjects, clientBreakdown]);

  if (selectedClient && clientDetail) {
    return <ClientDetailView client={clientDetail} color={color} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Focus Client ({clientBreakdown.length})</h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none w-48" />
        </div>
      </div>

      {/* Client cards grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(c => {
          const mbPct = c.ca > 0 ? Math.round(c.mb / c.ca * 1000) / 10 : 0;
          const obj = objByClient[c.name] || 0;
          const objPct = obj > 0 ? Math.round(c.ca / obj * 100) : 0;
          return (
            <button key={c.name} onClick={() => setSelectedClient(c.name)}
              className="text-left bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#e63946]/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-bold text-white truncate flex-1">{c.name}</h4>
                <span className="text-lg font-extrabold italic text-white ml-2">{fmtK(c.ca)}</span>
              </div>
              <div className="flex gap-4 text-xs text-[#888]">
                <span>MB <span className={mbPct >= 54 ? 'text-[#2ecc71] font-bold' : mbPct >= 45 ? 'text-[#f39c12] font-bold' : 'text-[#e74c3c] font-bold'}>{fmtPct(mbPct)}</span></span>
                <span>{c.projects?.length || 0} projets</span>
                {c.pipeProbabilise > 0 && <span className="text-[#3b82f6]">Pipe {fmtK(c.pipeProbabilise)}</span>}
              </div>
              {/* Rappel subtil de l'objectif du client */}
              {obj > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div className="h-1 rounded-full" style={{ width: `${Math.min(objPct, 100)}%`, backgroundColor: objPct >= 100 ? '#2ecc71' : objPct >= 60 ? '#f39c12' : `${color}99` }} />
                  </div>
                  <span className="text-[10px] text-[#666] whitespace-nowrap">Obj {fmtK(obj)} · {objPct}%</span>
                </div>
              )}
              {c.pipeProbabilise > 0 && (
                <div className="mt-1.5">
                  <div className="text-[10px] text-[#888]">Projection: {fmtK(c.ca + c.pipeProbabilise)}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClientDetailView({ client, color, onBack }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[#888] hover:text-white transition-colors p-1"><ArrowLeft size={20} /></button>
        <h2 className="text-lg font-bold text-white">{client.name}</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#888] uppercase">CA HT</p>
          <p className="text-xl font-extrabold italic text-white">{fmtK(client.ca)}</p>
        </div>
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#888] uppercase">Marge Brute</p>
          <p className="text-xl font-extrabold italic text-white">{fmtK(client.mb)}</p>
          <p className={`text-xs font-bold ${client.mbPct >= 54 ? 'text-[#2ecc71]' : client.mbPct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'}`}>MB {fmtPct(client.mbPct)}</p>
        </div>
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#888] uppercase">Pipe Proba</p>
          <p className="text-xl font-extrabold italic text-[#3b82f6]">{fmtK(client.pipeProbabilise || 0)}</p>
        </div>
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-xs text-[#888] uppercase">Projets</p>
          <p className="text-xl font-extrabold italic text-white">{client.projects.length}</p>
          <p className="text-xs text-[#2ecc71]">{client.active.length} actifs</p>
        </div>
      </div>

      {/* Projets — projets en cours (actifs) remontés en priorité */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <h4 className="text-sm font-bold text-[#ccc] uppercase tracking-wider mb-3">Projets ({client.projects.length})<span className="text-[#2ecc71] ml-2 normal-case">· {client.active.length} en cours</span></h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Projet', 'CA', 'MB', 'MB%', 'Vendu', 'Fait', 'Avance.', 'Debut', 'Fin'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-xs font-bold uppercase text-[#888]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {client.projects.map(p => {
                const pct = p.time_sold_days > 0 ? Math.round(p.time_spent_days / p.time_sold_days * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-[#1a1a1a]">
                    <td className="py-2 px-2 max-w-[200px]">
                      <p className="text-white font-medium truncate">{p.title}</p>
                      {p.type_label && <p className="text-[10px] text-[#555]">{p.type_label}</p>}
                    </td>
                    <td className="py-2 px-2 font-bold text-white whitespace-nowrap">{fmtK(p.total_amount)}</td>
                    <td className="py-2 px-2 text-[#ccc] whitespace-nowrap">{fmtK(p.marginEur)}</td>
                    <td className="py-2 px-2"><span style={{ color: p.margin >= 54 ? '#2ecc71' : p.margin >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(p.margin)}</span></td>
                    <td className="py-2 px-2 text-[#888]">{p.time_sold_days > 0 ? `${fmtNum(p.time_sold_days, 1)}j` : '—'}</td>
                    <td className="py-2 px-2 text-[#ccc]">{p.time_spent_days > 0 ? `${fmtNum(p.time_spent_days, 1)}j` : '—'}</td>
                    <td className="py-2 px-2 w-24">
                      {p.time_sold_days > 0 ? (
                        <div className="flex items-center gap-1">
                          <div className="flex-1"><ProgressBar value={pct} max={100} /></div>
                          <span className="text-[10px] text-[#888]">{pct}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-2 text-xs text-[#888] whitespace-nowrap">{formatDate(p.start_date)}</td>
                    <td className="py-2 px-2 text-xs text-[#888] whitespace-nowrap">{formatDate(p.end_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Devis en cours */}
      {client.devis.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <h4 className="text-sm font-bold text-[#3b82f6] uppercase tracking-wider mb-3">
            Devis en cours ({client.devis.length}) — Pipe Proba: {fmtK(client.pipeProbabilise)}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Devis', 'Montant', 'Proba', 'CA Proba', 'Debut prev.', 'Fin prev.'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-xs font-bold uppercase text-[#888]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {client.devis.sort((a, b) => b.probabilise - a.probabilise).map(d => (
                  <tr key={d.id} className="border-b border-[#1a1a1a]">
                    <td className="py-2 px-2 text-white font-medium truncate max-w-[250px]">{d.title}</td>
                    <td className="py-2 px-2 text-[#ccc]">{fmtK(d.amount)}</td>
                    <td className="py-2 px-2"><span className={d.probability >= 70 ? 'text-[#2ecc71]' : d.probability >= 40 ? 'text-[#f39c12]' : 'text-[#888]'}>{d.probability}%</span></td>
                    <td className="py-2 px-2 font-bold text-[#3b82f6]">{fmtK(d.probabilise)}</td>
                    <td className="py-2 px-2 text-xs text-[#888]">{formatDate(d.projet_start)}</td>
                    <td className="py-2 px-2 text-xs text-[#888]">{formatDate(d.projet_stop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CA Mensuel (facturé émis vs planifié) */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <h4 className="text-sm font-bold text-[#ccc] uppercase tracking-wider mb-1">CA par mois (facturé)</h4>
        <div className="flex items-center gap-4 mb-3 text-[10px] text-[#888]">
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: color }} />CA facturé (émis)</span>
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1 bg-[#3b82f6]" />CA planifié (factures futures)</span>
        </div>
        <ChartWrapper height={180}>
          <BarChart data={client.monthlyData} barSize={14} barCategoryGap="20%">
            <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} width={40}
              tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
            <Tooltip formatter={v => fmtK(v)} contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff' }} labelStyle={{ color: '#ccc' }} itemStyle={{ color: '#fff' }} />
            <Bar dataKey="ca" name="CA facturé" fill={color} radius={[3, 3, 0, 0]} />
            <Bar dataKey="caPlan" name="CA planifié" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.7} />
          </BarChart>
        </ChartWrapper>
      </div>
    </div>
  );
}
