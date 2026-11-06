import { Store, Shirt, Landmark, Megaphone, Target } from 'lucide-react';

// Matrice des marques à conquérir, par typologie de client. Curée (cibles Biz Dev 26/27).
const TYPOS = [
  {
    key: 'distrib', label: 'Distributeurs', color: '#06b6d4', Icon: Store, desc: 'Enseignes & retail',
    brands: ['Dafy Moto', 'Back Market', 'Jules'],
  },
  {
    key: 'equip', label: 'Équipementiers', color: '#e63946', Icon: Shirt, desc: 'Marques de sport & matériel',
    brands: ['Tecnifibre', 'Salomon', 'Oakley', 'Suunto', 'Canyon', 'Tudor', 'Tissot', 'Amazfit', 'Technogym', 'Obut'],
  },
  {
    key: 'instit', label: 'Institutions', color: '#f39c12', Icon: Landmark, desc: 'Fédérations, clubs, événements',
    brands: ['France Galop', 'UTMB', 'FFT', 'Paris Saint-Germain', 'Groupama FDJ United'],
  },
  {
    key: 'annonc', label: 'Annonceurs', color: '#8b5cf6', Icon: Megaphone, desc: 'Marques non-endémiques',
    brands: ['Google Pixel', 'Midea', 'Engie', 'Lavazza', 'Bitpanda', 'Hyundai', 'Lucca', 'Allianz', 'Paloma', 'Monster Energy', 'Danone', 'CMA CGM', 'Revolut', 'Panzani', 'Maif', 'SVR', 'Vitamin Well', 'Alpine'],
  },
];

export default function MatriceClient() {
  const total = TYPOS.reduce((s, t) => s + t.brands.length, 0);
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center"><Target size={20} className="text-[#8b5cf6]" /></div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Matrice client : marques à conquérir</h2>
          <p className="text-[#888] text-sm">{total} marques cibles, réparties par typologie</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TYPOS.map(t => {
          const Icon = t.Icon;
          return (
            <div key={t.key} className="bg-[#141414] border rounded-2xl overflow-hidden" style={{ borderColor: `${t.color}44` }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: `${t.color}14`, borderBottom: `1px solid ${t.color}33` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${t.color}22` }}><Icon size={17} style={{ color: t.color }} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold italic uppercase tracking-tight text-white">{t.label}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}22`, color: t.color }}>{t.brands.length}</span>
                  </div>
                  <p className="text-[10px] text-[#777]">{t.desc}</p>
                </div>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {t.brands.map(b => (
                  <span key={b} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ddd] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 hover:border-[#3a3a3a] transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />{b}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[#666]">Cibles de conquête Biz Dev, exercice 26/27. Typologies : distributeurs, équipementiers, institutions, annonceurs.</p>
    </div>
  );
}
