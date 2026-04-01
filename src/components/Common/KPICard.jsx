import { useEffect, useState } from 'react';

const formatSmartValue = (value, suffix) => {
  if (typeof value !== 'number') return { display: value, unit: suffix };
  const isCurrency = suffix === '€' || suffix === 'EUR';
  const abs = Math.abs(value);
  if (isCurrency || abs >= 100000) {
    if (abs >= 1000000) return { display: (value / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }), unit: isCurrency ? 'M€' : 'M' };
    if (abs >= 10000) return { display: Math.round(value / 1000).toLocaleString('fr-FR'), unit: isCurrency ? 'K€' : 'K' };
  }
  return { display: value.toLocaleString('fr-FR', { maximumFractionDigits: abs >= 100 ? 0 : 1 }), unit: suffix };
};

export default function KPICard({ label, value, suffix = '', icon, color, subtitle, onClick }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(true); }, []);
  const { display: displayVal, unit: displaySuffix } = formatSmartValue(value, suffix);

  return (
    <div onClick={onClick}
      className={`bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5 transition-all duration-300 ${show ? 'animate-count' : 'opacity-0'} ${onClick ? 'cursor-pointer hover:border-[#e63946]' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#888] text-xs font-semibold uppercase tracking-wider">{label}</span>
        {icon && <span className="text-[#888]">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl md:text-3xl font-extrabold italic ${color || 'text-white'}`}>{displayVal}</span>
        {displaySuffix && <span className="text-[#888] text-sm font-medium">{displaySuffix}</span>}
      </div>
      {subtitle && <p className="text-[#888] text-xs mt-1 font-light">{subtitle}</p>}
    </div>
  );
}
