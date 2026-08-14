import { fmtK, fmtPct } from '../../utils/format';

/**
 * Jauge de suivi d'objectif annuel.
 * - Barre remplie = CA réalisé (couleur selon l'avance vs le temps écoulé)
 * - Extension claire = pipe pondéré (projection si le pipe se signe)
 * - Repère vertical = rythme attendu (temps écoulé dans l'exercice)
 */
export default function ObjectiveGauge({ label, realized = 0, target = 0, pipe = 0, pace = 0, color = '#8b5cf6' }) {
  const pct = target > 0 ? realized / target * 100 : 0;
  const pctR = Math.round(pct);
  const barR = Math.min(pct, 100);
  const barPipe = Math.min(Math.max(0, (realized + pipe) / (target || 1) * 100), 100);
  // Avance : réalisé rapporté au rythme attendu. >=1 → dans les temps.
  const onPace = pace > 0 ? pct / pace : (pct > 0 ? 2 : 0);
  const barColor = onPace >= 1 ? '#2ecc71' : onPace >= 0.7 ? '#f39c12' : '#e74c3c';
  const projTotal = realized + pipe;
  const projPct = target > 0 ? Math.round(projTotal / target * 100) : 0;

  return (
    <div className="bg-[#161616] border rounded-xl p-4 md:p-5" style={{ borderColor: `${color}40` }}>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-[#888]">{label}</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-extrabold italic text-white">{fmtK(realized)}</span>
            <span className="text-sm text-[#666] font-semibold">/ {fmtK(target)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black italic leading-none" style={{ color: barColor }}>{pctR}%</div>
          <div className="text-[10px] text-[#666] font-semibold mt-1">
            rythme attendu <span className="text-[#aaa] font-bold">{Math.round(pace)}%</span>
          </div>
        </div>
      </div>

      {/* Barre */}
      <div className="relative h-5 bg-[#0d0d0d] rounded-full overflow-hidden border border-[#2a2a2a]">
        {/* pipe pondéré (projection) */}
        {pipe > 0 && (
          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{ width: `${barPipe}%`, backgroundColor: `${color}33` }} />
        )}
        {/* réalisé */}
        <div className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${barR}%`, backgroundColor: barColor }} />
        {/* repère rythme attendu */}
        {pace > 0 && pace < 100 && (
          <div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${pace}%` }} title={`Rythme attendu : ${Math.round(pace)}%`}>
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 mt-2.5 text-[10px] flex-wrap">
        <span className="flex items-center gap-1.5 text-[#aaa]">
          <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: barColor }} /> Réalisé {fmtK(realized)}
        </span>
        {pipe > 0 && (
          <span className="flex items-center gap-1.5 text-[#888]">
            <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: `${color}55` }} /> + pipe pondéré {fmtK(pipe)} → <span style={{ color }} className="font-bold">{projPct}% projeté</span>
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[#888] ml-auto">
          <i className="w-0.5 h-2.5 bg-white/70 inline-block" /> Rythme exercice
        </span>
      </div>
    </div>
  );
}
