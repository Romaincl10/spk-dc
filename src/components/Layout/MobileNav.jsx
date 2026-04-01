import { LayoutDashboard, Users, FolderKanban, FileBarChart, Target, Shield, Link2 } from 'lucide-react';

const DC_TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'projets', label: 'Projets', icon: FolderKanban },
  { id: 'pipeline', label: 'Pipeline', icon: FileBarChart },
  { id: 'objectifs', label: 'Objectifs', icon: Target },
];

const ADMIN_TABS = [
  { id: 'admin-dashboard', label: 'Global', icon: Shield },
  { id: 'admin-assignments', label: 'Assigner', icon: Link2 },
  { id: 'projets', label: 'Projets', icon: FolderKanban },
  { id: 'pipeline', label: 'Pipeline', icon: FileBarChart },
  { id: 'objectifs', label: 'Objectifs', icon: Target },
];

export default function MobileNav({ currentPage, onPageChange, userRole }) {
  const tabs = userRole === 'admin' ? ADMIN_TABS : DC_TABS;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#2a2a2a] flex items-center justify-around py-2 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = currentPage === t.id;
        return (
          <button key={t.id} onClick={() => onPageChange(t.id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 ${active ? 'text-[#e63946]' : 'text-[#888]'}`}>
            <Icon size={20} />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
