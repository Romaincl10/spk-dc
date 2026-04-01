import { useMemo, useState } from 'react';
import { Search, TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import DataTable from '../Common/DataTable';
import KPICard from '../Common/KPICard';
import ChartWrapper from '../Common/ChartWrapper';
import { fmtK, fmtPct } from '../../utils/format';
import { formatDate } from '../../utils/dateRange';

const PIPE_LABELS = {
  0: 'Lead', 1: 'Qualification', 2: 'Proposition', 3: 'Negociation',
  4: 'En attente', 5: 'Signature', 6: 'Gagne', 7: 'Perdu',
};

const PIPE_COLORS = {
  0: '#888', 1: '#3b82f6', 2: '#8b5cf6', 3: '#f39c12',
  4: '#06b6d4', 5: '#2ecc71', 6: '#2ecc71', 7: '#e74c3c',
};

export default function Pipeline({ portfolio }) {
  const [search, setSearch] = useState('');
  const proposals = portfolio?.proposals || [];

  // Active pipeline (not signed, not lost)
  const activeProposals = useMemo(() => {
    return proposals.filter(p => {
      const pipe = Number(p.pipe);
      return pipe >= 0 && pipe <= 5 && !p.signature_date;
    });
  }, [proposals]);

  const filtered = useMemo(() => {
    if (!search) return activeProposals;
    const s = search.toLowerCase();
    return activeProposals.filter(p =>
      (p.title || '').toLowerCase().includes(s) ||
      (p.company_name || '').toLowerCase().includes(s)
    );
  }, [activeProposals, search]);

  // KPIs
  const totalPipeline = activeProposals.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalProbabilise = activeProposals.reduce((s, p) =>
    s + (Number(p.amount) || 0) * (Number(p.probability) || 0) / 100, 0);
  const signedCount = proposals.filter(p => p.signature_date).length;
  const tauxConversion = proposals.length > 0 ? Math.round(signedCount / proposals.length * 100) : 0;

  // Funnel data
  const funnelData = useMemo(() => {
    const map = {};
    activeProposals.forEach(p => {
      const pipe = Number(p.pipe) || 0;
      const label = PIPE_LABELS[pipe] || `Etape ${pipe}`;
      if (!map[pipe]) map[pipe] = { pipe, label, count: 0, amount: 0 };
      map[pipe].count++;
      map[pipe].amount += Number(p.amount) || 0;
    });
    return Object.values(map).sort((a, b) => a.pipe - b.pipe);
  }, [activeProposals]);

  const columns = [
    { key: 'title', label: 'Devis', width: '25%',
      render: (v, row) => (
        <div>
          <p className="font-medium text-white truncate max-w-[200px]">{v}</p>
          <p className="text-xs text-[#888]">{row.company_name}</p>
        </div>
      )},
    { key: 'amount', label: 'Montant', render: v => <span className="font-bold">{fmtK(Number(v) || 0)}</span> },
    { key: 'probability', label: 'Proba.',
      render: v => <span className={Number(v) >= 70 ? 'text-[#2ecc71]' : Number(v) >= 40 ? 'text-[#f39c12]' : 'text-[#888]'}>{v || 0}%</span> },
    { key: 'pipe', label: 'Etape',
      render: v => {
        const label = PIPE_LABELS[Number(v)] || v;
        const color = PIPE_COLORS[Number(v)] || '#888';
        return <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ backgroundColor: `${color}20`, color }}>{label}</span>;
      }},
    { key: 'created_at', label: 'Date', render: v => <span className="text-xs">{formatDate(v)}</span> },
    { key: '_probabilise', label: 'CA Prob.',
      render: (_, row) => fmtK(Math.round((Number(row.amount) || 0) * (Number(row.probability) || 0) / 100)),
      sortable: false },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Mon Pipeline</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none w-48" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Pipeline Total" value={totalPipeline} suffix="€" icon={<FileText size={16} />} />
        <KPICard label="CA Probabilise" value={totalProbabilise} suffix="€" icon={<TrendingUp size={16} />} />
        <KPICard label="Devis Actifs" value={activeProposals.length} icon={<BarChart3 size={16} />} />
        <KPICard label="Taux Conversion" value={tauxConversion} suffix="%" color={tauxConversion >= 40 ? 'text-[#2ecc71]' : 'text-[#f39c12]'} />
      </div>

      {/* Funnel chart */}
      {funnelData.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-4">Funnel Pipeline</h3>
          <ChartWrapper height={200}>
            <BarChart data={funnelData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
              <YAxis type="category" dataKey="label" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip formatter={v => fmtK(v)} contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff' }} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {funnelData.map((d, i) => <Cell key={i} fill={PIPE_COLORS[d.pipe] || '#888'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </div>
      )}

      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <DataTable columns={columns} data={filtered} pageSize={30} />
      </div>
    </div>
  );
}
