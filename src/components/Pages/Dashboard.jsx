import { useMemo } from 'react';
import { Briefcase, Users, TrendingUp, Target, FileBarChart, Euro } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import KPICard from '../Common/KPICard';
import ChartWrapper from '../Common/ChartWrapper';
import ProgressBar from '../Common/ProgressBar';
import { fmtK, fmtPct } from '../../utils/format';

const COLORS = ['#e63946', '#3b82f6', '#2ecc71', '#f39c12', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Dashboard({ portfolio, objectives }) {
  const kpis = portfolio?.kpis || {};
  const projects = portfolio?.projects || [];

  // Monthly CA from projects
  const monthlyCA = useMemo(() => {
    const months = {};
    projects.filter(p => p.inFY).forEach(p => {
      const d = p.start_date ? new Date(p.start_date) : null;
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = (months[key] || 0) + p.total_amount;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, ca]) => {
        const [y, m] = month.split('-');
        const label = new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'short' });
        return { month: label, ca: Math.round(ca) };
      });
  }, [projects]);

  // Client distribution by CA
  const clientCA = useMemo(() => {
    const map = {};
    projects.filter(p => p.inFY).forEach(p => {
      const name = p.company_name || 'Inconnu';
      map[name] = (map[name] || 0) + p.total_amount;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, ca]) => ({ name: name.length > 20 ? name.slice(0, 18) + '...' : name, ca: Math.round(ca) }));
  }, [projects]);

  // Last 5 active projects
  const recentProjects = useMemo(() => {
    return [...projects]
      .filter(p => p.actif === '1' || p.actif === 1)
      .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0))
      .slice(0, 5);
  }, [projects]);

  // Objective progress (CA annuel)
  const caObjective = objectives?.find(o => o.type === 'ca_annuel');
  const caProgress = caObjective ? Math.round((kpis.caTotal / caObjective.target) * 100) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white">Mon Portefeuille</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="CA Total" value={kpis.caTotal} suffix="€" icon={<Euro size={16} />} />
        <KPICard label="Marge Moy." value={kpis.margeMoyenne} suffix="%" icon={<TrendingUp size={16} />}
          color={kpis.margeMoyenne >= 54 ? 'text-[#2ecc71]' : kpis.margeMoyenne >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Projets Actifs" value={kpis.projetsActifs} icon={<Briefcase size={16} />} />
        <KPICard label="Clients" value={kpis.clientsActifs} icon={<Users size={16} />} />
        <KPICard label="Pipeline" value={kpis.pipelineTotal} suffix="€" icon={<FileBarChart size={16} />} />
        <KPICard label="Avancement" value={kpis.avancementGlobal} suffix="%"
          icon={<Target size={16} />}
          color={kpis.avancementGlobal > 100 ? 'text-[#e74c3c]' : 'text-[#2ecc71]'} />
      </div>

      {/* Objective progress */}
      {caObjective && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-3">Objectif CA Annuel</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <ProgressBar value={kpis.caTotal} max={caObjective.target}
                label={`${fmtK(kpis.caTotal)} / ${fmtK(caObjective.target)}`} />
            </div>
            <span className="text-2xl font-extrabold italic text-white">{caProgress}%</span>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Monthly CA */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-4">CA Mensuel</h3>
          {monthlyCA.length > 0 ? (
            <ChartWrapper height={220}>
              <BarChart data={monthlyCA}>
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
                <Tooltip formatter={v => fmtK(v)} contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff' }} labelStyle={{ color: '#ccc' }} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="ca" fill="#e63946" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartWrapper>
          ) : <p className="text-[#555] text-sm text-center py-8">Pas de donnees</p>}
        </div>

        {/* Client distribution */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-4">Repartition Clients</h3>
          {clientCA.length > 0 ? (
            <ChartWrapper height={220}>
              <PieChart>
                <Pie data={clientCA} dataKey="ca" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  {clientCA.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtK(v)} contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff' }} labelStyle={{ color: '#ccc' }} itemStyle={{ color: '#fff' }} />
              </PieChart>
            </ChartWrapper>
          ) : <p className="text-[#555] text-sm text-center py-8">Pas de donnees</p>}
        </div>
      </div>

      {/* Recent projects */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-4">Derniers Projets Actifs</h3>
        <div className="space-y-3">
          {recentProjects.length === 0 && <p className="text-[#555] text-sm">Aucun projet actif</p>}
          {recentProjects.map(p => {
            const pct = p.time_sold_days > 0 ? Math.round(p.time_spent_days / p.time_sold_days * 100) : 0;
            return (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.title}</p>
                  <p className="text-xs text-[#888]">{p.company_name}</p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <span className="text-xs text-[#888]">{fmtK(p.total_amount)}</span>
                  <div className="w-24">
                    <ProgressBar value={pct} max={100} />
                  </div>
                  <span className={`text-xs font-bold ${pct > 100 ? 'text-[#e74c3c]' : 'text-[#2ecc71]'}`}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
