import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function DataTable({ columns, data, onRowClick, pageSize = 50, emptyMessage = 'Aucune donnee' }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey || !data) return data || [];
    return [...data].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (!data || data.length === 0) {
    return <p className="text-center text-[#888] py-12 font-light">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`text-left px-3 py-3 text-xs font-bold uppercase text-[#888] tracking-wider ${col.sortable !== false ? 'cursor-pointer hover:text-white select-none' : ''}`}
                  style={{ width: col.width }}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={row._id || row.id || i} onClick={() => onRowClick?.(row)}
                className={`border-b border-[#1a1a1a] transition-colors ${onRowClick ? 'cursor-pointer hover:bg-[#1a1a1a]' : ''}`}>
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-3 text-[#ccc] font-normal">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {paged.map((row, i) => (
          <div key={row._id || row.id || i} onClick={() => onRowClick?.(row)}
            className={`bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 ${onRowClick ? 'cursor-pointer active:bg-[#1a1a1a]' : ''}`}>
            {columns.slice(0, 5).map(col => (
              <div key={col.key} className="flex justify-between items-center py-1">
                <span className="text-xs text-[#888] font-semibold uppercase">{col.label}</span>
                <span className="text-sm text-[#ccc]">{col.render ? col.render(row[col.key], row) : (row[col.key] ?? '')}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <span className="text-xs text-[#888] font-light">{sorted.length} resultats — Page {page + 1}/{totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#2a2a2a] rounded-lg hover:bg-[#333] disabled:opacity-30 text-white">Precedent</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#2a2a2a] rounded-lg hover:bg-[#333] disabled:opacity-30 text-white">Suivant</button>
          </div>
        </div>
      )}
    </div>
  );
}
