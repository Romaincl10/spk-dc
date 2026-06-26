import { LayoutDashboard, Shield, UserCog, Upload, Link2, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const DC_PAGES = [
  { id: 'admin-dashboard', label: 'Mon Portfolio', icon: LayoutDashboard },
  { id: 'pilotage', label: 'Pilotage', icon: Activity },
];

const ADMIN_PAGES = [
  { id: 'admin-dashboard', label: 'Vue Globale', icon: Shield },
  { id: 'pilotage', label: 'Pilotage', icon: Activity },
  { id: 'admin-assignments', label: 'Assignations', icon: Link2 },
  { id: 'admin-users', label: 'Gestion DC', icon: UserCog },
  { id: 'admin-objectifs', label: 'Import Objectifs', icon: Upload },
];

export default function Sidebar({ currentPage, onPageChange, userRole }) {
  const [collapsed, setCollapsed] = useState(false);
  const pages = userRole === 'admin' ? ADMIN_PAGES : DC_PAGES;

  return (
    <aside className={`hidden md:flex flex-col bg-[#111] border-r border-[#2a2a2a] transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
        {!collapsed && <h1 className="text-lg font-extrabold italic text-white">SPK <span className="text-[#e63946]">DC</span></h1>}
        <button onClick={() => setCollapsed(!collapsed)} className="text-[#888] hover:text-white p-1">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1">
        {pages.map((p, i) => {
          if (p.id === 'divider') {
            return <div key={i} className="my-3 mx-3 border-t border-[#2a2a2a]" />;
          }
          const Icon = p.icon;
          const active = currentPage === p.id;
          return (
            <button key={p.id} onClick={() => onPageChange(p.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                ${active ? 'text-[#e63946] bg-[#e63946]/10 border-r-2 border-[#e63946]' : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'}`}>
              <Icon size={18} />
              {!collapsed && <span>{p.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-[#2a2a2a]">
          <p className="text-[10px] text-[#555] font-light">SPK DC v1.0</p>
        </div>
      )}
    </aside>
  );
}
