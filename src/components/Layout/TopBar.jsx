import { LogOut, RefreshCw, User, Menu } from 'lucide-react';
import { useState } from 'react';

export default function TopBar({ user, onLogout, onSync, syncing, onMenuToggle }) {
  return (
    <header className="h-14 bg-[#111] border-b border-[#2a2a2a] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="md:hidden text-[#888] hover:text-white">
          <Menu size={20} />
        </button>
        <div className="md:hidden text-lg font-extrabold italic text-white">SPK <span className="text-[#e63946]">DC</span></div>
      </div>

      <div className="flex items-center gap-4">
        {user?.role === 'admin' && (
          <button onClick={onSync} disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{syncing ? 'Sync...' : 'Synchroniser'}</span>
          </button>
        )}

        <div className="flex items-center gap-2 text-sm">
          <User size={14} className="text-[#888]" />
          <span className="text-[#ccc] font-medium">{user?.name}</span>
          <span className="text-[10px] text-[#555] bg-[#2a2a2a] px-1.5 py-0.5 rounded uppercase font-bold">
            {user?.role}
          </span>
        </div>

        <button onClick={onLogout} className="text-[#888] hover:text-[#e63946] transition-colors" title="Se deconnecter">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
