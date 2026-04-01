import { useMemo, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import DataTable from '../Common/DataTable';
import TrafficLight from '../Common/TrafficLight';
import ProgressBar from '../Common/ProgressBar';
import { fmtK, fmtPct } from '../../utils/format';
import { formatDate } from '../../utils/dateRange';

function getTrafficLight(margePercent) {
  if (margePercent >= 54) return 'green';
  if (margePercent >= 45) return 'orange';
  return 'red';
}

const STATUS_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'ended', label: 'Termines' },
];

export default function Projets({ portfolio }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const projects = portfolio?.projects || [];

  const filtered = useMemo(() => {
    let list = projects.filter(p => p.inFY);

    if (statusFilter === 'active') {
      list = list.filter(p => p.actif === '1' || p.actif === 1);
    } else if (statusFilter === 'ended') {
      list = list.filter(p => p.actif !== '1' && p.actif !== 1);
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(s) ||
        (p.company_name || '').toLowerCase().includes(s)
      );
    }

    return list;
  }, [projects, search, statusFilter]);

  const columns = [
    { key: 'title', label: 'Projet', width: '25%',
      render: (v, row) => (
        <div>
          <p className="font-medium text-white truncate max-w-[200px]">{v}</p>
          <p className="text-xs text-[#888]">{row.company_name}</p>
        </div>
      )},
    { key: 'total_amount', label: 'CA', render: v => <span className="font-bold">{fmtK(v)}</span> },
    { key: 'margin', label: 'Marge',
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <TrafficLight status={getTrafficLight(v)} small />
          <span>{fmtPct(v)}</span>
        </div>
      )},
    { key: 'time_spent_days', label: 'Avancement',
      render: (v, row) => {
        const pct = row.time_sold_days > 0 ? Math.round(v / row.time_sold_days * 100) : 0;
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1"><ProgressBar value={pct} max={100} /></div>
            <span className={`text-xs font-bold ${pct > 100 ? 'text-[#e74c3c]' : 'text-[#ccc]'}`}>{pct}%</span>
          </div>
        );
      }},
    { key: 'time_sold_days', label: 'Jrs Vendus', render: v => <span className="text-[#888]">{v}j</span> },
    { key: 'time_spent_days', label: 'Jrs Faits', key: '_spent_display',
      render: (_, row) => <span className="text-[#ccc]">{row.time_spent_days}j</span> },
    { key: 'start_date', label: 'Debut', render: v => <span className="text-xs">{formatDate(v)}</span> },
    { key: 'end_date', label: 'Fin', render: v => <span className="text-xs">{formatDate(v)}</span> },
  ];

  // Stats
  const totalCA = filtered.reduce((s, p) => s + p.total_amount, 0);
  const avgMargin = filtered.length > 0
    ? filtered.reduce((s, p) => s + (p.margin || 0), 0) / filtered.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Mes Projets</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#161616] rounded-lg p-1">
            {STATUS_FILTERS.map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors
                  ${statusFilter === f.id ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none w-44" />
          </div>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-[#888]">
        <span><strong className="text-white">{filtered.length}</strong> projets</span>
        <span>CA: <strong className="text-white">{fmtK(totalCA)}</strong></span>
        <span>Marge moy: <strong className={avgMargin >= 54 ? 'text-[#2ecc71]' : avgMargin >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'}>{fmtPct(avgMargin)}</strong></span>
      </div>

      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <DataTable columns={columns} data={filtered} pageSize={30} />
      </div>
    </div>
  );
}
