export default function TrafficLight({ status, label, value, small }) {
  const colors = { green: '#2ecc71', orange: '#f39c12', red: '#e74c3c', grey: '#555' };
  const c = colors[status] || colors.grey;
  const sz = small ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-2">
      <div className={`${sz} rounded-full`} style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}40` }} />
      {label && <span className="text-sm text-[#ccc] font-medium">{label}</span>}
      {value !== undefined && <span className="text-sm text-[#888] font-light ml-auto">{value}</span>}
    </div>
  );
}
