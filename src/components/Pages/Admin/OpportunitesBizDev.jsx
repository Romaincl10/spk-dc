import { useState, useEffect } from 'react';
import { ArrowUpRight, Radar, Target, Users, Sparkles } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

const CAT_COLORS = {
  Fitness: '#a3e635', Trail: '#ff5040', Running: '#ff5040', Tennis: '#ffd23c', Padel: '#ffd23c',
  Cyclisme: '#3ca0ff', Tech: '#06b6d4', Lifestyle: '#c084fc', Football: '#2ecc71', Basket: '#ff8a3d',
  Media: '#06b6d4', Auto: '#f43f5e', Hippisme: '#d9a441', Rugby: '#818cf8',
  Distributeur: '#14b8a6', Equipementier: '#e6a23c', Institution: '#f39c12', Annonceur: '#c084fc',
};
const colorFor = (c) => CAT_COLORS[c?.cat] || '#e63946';

function OppCard({ c }) {
  const col = colorFor(c);
  return (
    <div className="relative rounded-2xl border border-[#262626] overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(170deg,#161616 0%,#0d0d0d 65%)' }}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg,${col},${col}00)` }} />
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
            style={{ color: col, backgroundColor: `${col}1a`, border: `1px solid ${col}40` }}>{c.cat}</span>
          {c.date && <span className="text-[10px] font-bold text-[#888] bg-[#1c1c1c] px-2 py-0.5 rounded-full">{c.date}</span>}
        </div>
        <div className="text-[19px] font-black italic text-white leading-[1.05] tracking-tight">{c.client}</div>
        {c.actu && <p className="text-[12.5px] text-[#c4c4c4] leading-snug">{c.actu}</p>}
        {c.insight && (
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: `${col}12`, border: `1px solid ${col}2e` }}>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color: col }}>L'angle SPK</div>
            <p className="text-[12px] text-[#e8e8e8] leading-snug">{c.insight}</p>
          </div>
        )}
        {c.piste && (
          <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
            <span className="text-[11px] font-extrabold italic text-white">{c.piste.name}</span>
            {c.piste.offer && <span className="text-[10px] font-bold text-[#cfcfcf] bg-[#1a1a1a] border border-[#2c2c2c] px-2 py-0.5 rounded-lg">{c.piste.offer}</span>}
            {c.piste.budget && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg" style={{ color: col, backgroundColor: `${col}14` }}>{c.piste.budget}</span>}
          </div>
        )}
        {c.source?.url && (
          <a href={c.source.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#7a7a7a] hover:text-[#ccc] mt-0.5">
            via {c.source.name} <ArrowUpRight size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, subtitle, color, cards }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}1f`, color }}>{icon}</div>
        <h3 className="text-sm font-black italic uppercase tracking-wide text-white">{title}</h3>
        <span className="text-[11px] text-[#666]">{subtitle}</span>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}1a` }}>{cards.length}</span>
      </div>
      {cards.length === 0 ? (
        <p className="text-[#666] text-sm py-6 text-center bg-[#111] border border-[#232323] rounded-xl">Aucune opportunité pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cards.map((c, i) => <OppCard key={c.id || i} c={c} />)}
        </div>
      )}
    </div>
  );
}

// Vue Opportunités Biz Dev (directeur) : veille datée et sourcée, scindée
// Prospects (Matrice) / Clients actuels. Cartes visuelles, liens vers les sources.
export default function OpportunitesBizDev() {
  const [data, setData] = useState(null);
  const [seg, setSeg] = useState('prospects'); // 'prospects' | 'clients'

  useEffect(() => {
    let alive = true;
    apiFetch('/api/data/opportunites-bizdev')
      .then(d => { if (alive) setData(d); })
      .catch(e => { console.error('[BizDevOpp]', e); if (alive) setData({ prospects: [], clients: [] }); });
    return () => { alive = false; };
  }, []);

  if (!data) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>;

  const prospects = data.prospects || [];
  const clients = data.clients || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center"><Radar size={18} className="text-[#8b5cf6]" /></div>
        <div>
          <h2 className="text-base font-black italic text-white">Opportunités : veille Biz Dev</h2>
          <p className="text-[#888] text-xs">Actus datées et sourcées (News Tank, Sport Business, veille web) : angle SPK pour chaque marque.</p>
        </div>
      </div>

      {/* Bascule Prospects / Clients */}
      <div className="flex gap-1 bg-[#111] rounded-lg p-0.5 w-fit">
        <button onClick={() => setSeg('prospects')} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors ${seg === 'prospects' ? 'bg-[#8b5cf6] text-white' : 'text-[#888] hover:text-white'}`}>
          <Target size={13} /> Prospects <span className="opacity-70">({prospects.length})</span>
        </button>
        <button onClick={() => setSeg('clients')} className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors ${seg === 'clients' ? 'bg-[#2ecc71] text-white' : 'text-[#888] hover:text-white'}`}>
          <Users size={13} /> Clients actuels <span className="opacity-70">({clients.length})</span>
        </button>
      </div>

      {seg === 'prospects' && (
        <Section icon={<Target size={15} />} title="Prospects à conquérir" subtitle="marques de la Matrice client" color="#8b5cf6" cards={prospects} />
      )}
      {seg === 'clients' && (
        <Section icon={<Users size={15} />} title="Clients actuels" subtitle="rebonds et upsell sur le portefeuille" color="#2ecc71" cards={clients} />
      )}
    </div>
  );
}
