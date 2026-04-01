import { useMemo } from 'react';
import { Target, TrendingUp, Award } from 'lucide-react';
import KPICard from '../Common/KPICard';
import ProgressBar from '../Common/ProgressBar';
import { fmtK, fmtPct, fmtNum } from '../../utils/format';

export default function Objectifs({ portfolio, objectives }) {
  const kpis = portfolio?.kpis || {};

  // Compute actual values for each objective type
  const getActualValue = (type) => {
    switch (type) {
      case 'ca_annuel': return kpis.caTotal || 0;
      case 'nb_clients': return kpis.clientsActifs || 0;
      case 'marge_moyenne': return kpis.margeMoyenne || 0;
      case 'nb_projets': return kpis.projetsTotal || 0;
      case 'taux_signature': return kpis.pipelineTotal > 0 ? Math.round(kpis.caTotal / (kpis.caTotal + kpis.pipelineTotal) * 100) : 0;
      default: return 0;
    }
  };

  const formatValue = (val, type) => {
    if (type === 'ca_annuel') return fmtK(val);
    if (type === 'marge_moyenne' || type === 'taux_signature') return fmtPct(val);
    return fmtNum(val);
  };

  const objectifList = objectives || [];

  const enriched = useMemo(() => {
    return objectifList.map(obj => {
      const actual = getActualValue(obj.type);
      const progress = obj.target > 0 ? Math.round(actual / obj.target * 100) : 0;
      return { ...obj, actual, progress };
    });
  }, [objectifList, kpis]);

  const avgProgress = enriched.length > 0
    ? Math.round(enriched.reduce((s, o) => s + o.progress, 0) / enriched.length) : 0;
  const completedCount = enriched.filter(o => o.progress >= 100).length;

  if (objectifList.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h2 className="text-xl font-bold text-white">Mes Objectifs</h2>
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-12 text-center">
          <Target size={48} className="mx-auto text-[#555] mb-4" />
          <p className="text-[#888] text-lg mb-2">Aucun objectif defini</p>
          <p className="text-[#555] text-sm">Contactez votre administrateur pour definir vos objectifs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white">Mes Objectifs</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPICard label="Score Global" value={avgProgress} suffix="%"
          icon={<Award size={16} />}
          color={avgProgress >= 80 ? 'text-[#2ecc71]' : avgProgress >= 50 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Objectifs Atteints" value={completedCount} suffix={`/ ${enriched.length}`}
          icon={<Target size={16} />} color="text-[#2ecc71]" />
        <KPICard label="En Cours" value={enriched.length - completedCount}
          icon={<TrendingUp size={16} />} />
      </div>

      {/* Gauge composite */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-6 flex items-center justify-center">
        <svg viewBox="0 0 120 70" className="w-48 h-28">
          <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#2a2a2a" strokeWidth="8" strokeLinecap="round" />
          <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none"
            stroke={avgProgress >= 80 ? '#2ecc71' : avgProgress >= 50 ? '#f39c12' : '#e74c3c'}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${Math.min(avgProgress, 100) * 1.57} 157`}
            className="animate-gauge" />
          <text x="60" y="55" textAnchor="middle" fill="white" fontSize="20" fontWeight="900" fontStyle="italic">
            {avgProgress}%
          </text>
          <text x="60" y="67" textAnchor="middle" fill="#888" fontSize="7">PROGRESSION GLOBALE</text>
        </svg>
      </div>

      {/* Individual objectives */}
      <div className="space-y-3">
        {enriched.map((obj, i) => (
          <div key={i} className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-white">{obj.label}</h4>
                <p className="text-xs text-[#888]">{obj.period}</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold italic" style={{
                  color: obj.progress >= 100 ? '#2ecc71' : obj.progress >= 80 ? '#f39c12' : '#e74c3c'
                }}>{obj.progress}%</span>
              </div>
            </div>
            <ProgressBar value={obj.actual} max={obj.target}
              label={`${formatValue(obj.actual, obj.type)} / ${formatValue(obj.target, obj.type)}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
