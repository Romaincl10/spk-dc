import { useState } from 'react';
import { Radio, Target, Grid3x3 } from 'lucide-react';
import MediasView from './MediasView';
import HeatmapView from './HeatmapView';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;

// Page Médias autonome (rôle 'medias' : accès Médias uniquement) — Objectifs + Heatmap médias
export default function MediasPage({ fyStartYear, onFyChange, currentFyStartYear }) {
  const cur = currentFyStartYear ?? fyStartYear;
  const years = [cur, cur - 1];
  const [tab, setTab] = useState('objectifs'); // 'objectifs' | 'heatmap'
  const [openClient, setOpenClient] = useState(null);

  // Clic sur une tuile de la heatmap → ouvre la fiche client dans la vue Objectifs
  const handleOpenClient = ({ client }) => { setOpenClient({ name: client, key: Date.now() }); setTab('objectifs'); };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Radio size={18} className="text-[#06b6d4]" /> Médias — exercice {fyLabel(fyStartYear)}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-[#111] rounded-lg p-1">
            <button onClick={() => setTab('objectifs')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${tab === 'objectifs' ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}><Target size={13} /> Objectifs</button>
            <button onClick={() => setTab('heatmap')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${tab === 'heatmap' ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}><Grid3x3 size={13} /> Heatmap</button>
          </div>
          <div className="flex gap-1 bg-[#111] rounded-lg p-1">
            {years.map(y => (
              <button key={y} onClick={() => onFyChange?.(y)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${fyStartYear === y ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}>
                {fyLabel(y)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'objectifs' && <MediasView fyStartYear={fyStartYear} openClient={openClient} onOpened={() => setOpenClient(null)} />}
      {tab === 'heatmap' && <HeatmapView fyStartYear={fyStartYear} mediaOnly onOpenClient={handleOpenClient} />}
    </div>
  );
}
