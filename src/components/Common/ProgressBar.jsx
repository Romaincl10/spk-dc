export default function ProgressBar({ value = 0, max = 100, label, showValue = true, color }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const barColor = color || (pct >= 80 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c');

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-[#888] font-medium">{label}</span>
          {showValue && <span className="text-xs font-bold" style={{ color: barColor }}>{pct}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
