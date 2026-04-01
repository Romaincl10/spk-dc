import { useMemo, useState } from 'react';
import { Search, Building2, TrendingUp, FolderKanban, X } from 'lucide-react';
import DataTable from '../Common/DataTable';
import KPICard from '../Common/KPICard';
import { fmtK, fmtPct } from '../../utils/format';
import { formatDate } from '../../utils/dateRange';

export default function Clients({ portfolio }) {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  const projects = portfolio?.projects || [];

  // Build client list from projects
  const clients = useMemo(() => {
    const map = {};
    projects.filter(p => p.inFY).forEach(p => {
      const name = p.company_name || 'Inconnu';
      if (!map[name]) map[name] = { name, ca: 0, margin: 0, marginCount: 0, projects: [], lastDate: null };
      map[name].ca += p.total_amount;
      if (p.margin > 0) { map[name].margin += p.margin; map[name].marginCount++; }
      map[name].projects.push(p);
      const d = p.end_date || p.start_date;
      if (d && (!map[name].lastDate || d > map[name].lastDate)) map[name].lastDate = d;
    });

    return Object.values(map).map(c => ({
      ...c,
      margeMoyenne: c.marginCount > 0 ? Math.round(c.margin / c.marginCount * 10) / 10 : 0,
      nbProjets: c.projects.length,
      nbActifs: c.projects.filter(p => p.actif === '1' || p.actif === 1).length,
    })).sort((a, b) => b.ca - a.ca);
  }, [projects]);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(s));
  }, [clients, search]);

  const columns = [
    { key: 'name', label: 'Client', width: '30%' },
    { key: 'ca', label: 'CA', render: v => <span className="font-bold">{fmtK(v)}</span> },
    { key: 'margeMoyenne', label: 'Marge Moy.',
      render: v => <span className={v >= 30 ? 'text-[#2ecc71]' : v >= 18 ? 'text-[#f39c12]' : 'text-[#e74c3c]'}>{fmtPct(v)}</span> },
    { key: 'nbProjets', label: 'Projets' },
    { key: 'nbActifs', label: 'Actifs', render: v => <span className="text-[#2ecc71] font-bold">{v}</span> },
    { key: 'lastDate', label: 'Dernier', render: v => formatDate(v) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Mes Clients</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none w-48" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Clients Total" value={clients.length} icon={<Building2 size={16} />} />
        <KPICard label="CA Clients" value={clients.reduce((s, c) => s + c.ca, 0)} suffix="€" />
        <KPICard label="Marge Moy. Globale"
          value={clients.length > 0 ? Math.round(clients.reduce((s, c) => s + c.margeMoyenne, 0) / clients.length * 10) / 10 : 0}
          suffix="%" icon={<TrendingUp size={16} />} />
        <KPICard label="Projets Total" value={clients.reduce((s, c) => s + c.nbProjets, 0)} icon={<FolderKanban size={16} />} />
      </div>

      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <DataTable columns={columns} data={filtered} onRowClick={setSelectedClient} />
      </div>

      {/* Client detail drawer */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedClient(null)} />
          <div className="w-full max-w-lg bg-[#111] border-l border-[#2a2a2a] p-6 overflow-y-auto animate-slide-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{selectedClient.name}</h3>
              <button onClick={() => setSelectedClient(null)} className="text-[#888] hover:text-white"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#161616] rounded-lg p-3">
                <p className="text-xs text-[#888] uppercase">CA Total</p>
                <p className="text-lg font-bold text-white">{fmtK(selectedClient.ca)}</p>
              </div>
              <div className="bg-[#161616] rounded-lg p-3">
                <p className="text-xs text-[#888] uppercase">Marge Moy.</p>
                <p className="text-lg font-bold" style={{ color: selectedClient.margeMoyenne >= 54 ? '#2ecc71' : selectedClient.margeMoyenne >= 45 ? '#f39c12' : '#e74c3c' }}>
                  {fmtPct(selectedClient.margeMoyenne)}
                </p>
              </div>
            </div>

            <h4 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-3">Projets ({selectedClient.nbProjets})</h4>
            <div className="space-y-2">
              {selectedClient.projects.map(p => {
                const pct = p.time_sold_days > 0 ? Math.round(p.time_spent_days / p.time_sold_days * 100) : 0;
                return (
                  <div key={p.id} className="bg-[#161616] rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-white">{p.title}</p>
                      <span className="text-xs text-[#888] ml-2">{fmtK(p.total_amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: pct > 100 ? '#e74c3c' : '#2ecc71'
                        }} />
                      </div>
                      <span className="text-xs text-[#888]">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
