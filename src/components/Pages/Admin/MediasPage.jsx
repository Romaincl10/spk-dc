import { Radio } from 'lucide-react';
import MediasView from './MediasView';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;

// Page Médias autonome (rôle 'medias' : accès Médias uniquement)
export default function MediasPage({ fyStartYear, onFyChange, currentFyStartYear }) {
  const cur = currentFyStartYear ?? fyStartYear;
  const years = [cur, cur - 1];
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Radio size={18} className="text-[#06b6d4]" /> Médias — exercice {fyLabel(fyStartYear)}</h2>
        <div className="flex gap-1 bg-[#111] rounded-lg p-1">
          {years.map(y => (
            <button key={y} onClick={() => onFyChange?.(y)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${fyStartYear === y ? 'bg-[#06b6d4] text-white' : 'text-[#888] hover:text-white'}`}>
              {fyLabel(y)}
            </button>
          ))}
        </div>
      </div>
      <MediasView fyStartYear={fyStartYear} />
    </div>
  );
}
