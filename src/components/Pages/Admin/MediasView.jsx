import { useState, useEffect } from 'react';
import { Radio, Briefcase, FileText } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import { apiFetch } from '../../../utils/api';
import { fmtK, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
const MEDIA = '#06b6d4';

export default function MediasView({ fyStartYear }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/api/data/medias?fy=${fyStartYear}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[Medias]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fyStartYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#06b6d4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const projects = data?.projects || [];
  const devis = data?.devis || [];
  const totals = data?.totals || { projectsCount: 0, caSigne: 0, mbEur: 0, devisCount: 0, pipe: 0, pipeBrut: 0, margePct: 0 };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#06b6d4]/15 flex items-center justify-center">
          <Radio size={20} className="text-[#06b6d4]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Médias — BU footpack · runpack · velopack…</h2>
          <p className="text-[#888] text-sm">Tous les projets & devis médias (code MED0) — exercice {fyLabel(fyStartYear)}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="CA signé médias" value={totals.caSigne} suffix="€"
          subtitle={`${totals.projectsCount} projets`} color="text-[#06b6d4]" />
        <KPICard label="Marge brute" value={totals.mbEur} suffix="€" subtitle={`MB ${fmtPct(totals.margePct || 0)}`}
          color={totals.margePct >= 54 ? 'text-[#2ecc71]' : totals.margePct >= 45 ? 'text-[#f39c12]' : 'text-[#e74c3c]'} />
        <KPICard label="Pipe pondéré" value={totals.pipe} suffix="€"
          subtitle={`${totals.devisCount} devis · ${fmtK(totals.pipeBrut)} brut`} color="text-[#3b82f6]" />
        <KPICard label="Projets / Devis" value={totals.projectsCount} suffix={` / ${totals.devisCount}`} />
      </div>

      {/* Projets médias */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase size={16} className="text-[#06b6d4]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Projets médias</h3>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto" style={{ backgroundColor: `${MEDIA}20`, color: MEDIA }}>{projects.length}</span>
        </div>
        {projects.length === 0 ? (
          <p className="text-[#666] text-sm text-center py-4">Aucun projet médias sur l'exercice</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                  <th className="text-left py-2 px-2 font-bold">Projet</th>
                  <th className="text-left py-2 px-2 font-bold">Client</th>
                  <th className="text-right py-2 px-2 font-bold">CA</th>
                  <th className="text-right py-2 px-2 font-bold">MB%</th>
                  <th className="text-left py-2 px-2 font-bold">Période</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                    <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[280px]">{p.title}</td>
                    <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[150px]">{p.canonical_client || p.company_name}</td>
                    <td className="py-2 px-2 text-right font-bold text-white">{fmtK(p.total_amount)}</td>
                    <td className="py-2 px-2 text-right text-xs" style={{ color: p.margin >= 54 ? '#2ecc71' : p.margin >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(p.margin)}</td>
                    <td className="py-2 px-2 text-xs text-[#888] whitespace-nowrap">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#06b6d4]/30 bg-[#06b6d4]/5 font-bold">
                  <td className="py-2 px-2 text-white text-xs" colSpan={2}>TOTAL ({projects.length})</td>
                  <td className="py-2 px-2 text-right text-white">{fmtK(totals.caSigne)}</td>
                  <td className="py-2 px-2 text-right text-[#888] text-xs">{fmtPct(totals.margePct || 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Devis médias */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-[#3b82f6]" />
          <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider">Devis médias en cours</h3>
          <span className="text-xs font-bold px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full ml-auto">{devis.length}</span>
        </div>
        {devis.length === 0 ? (
          <p className="text-[#666] text-sm text-center py-4">Aucun devis médias en cours</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                  <th className="text-left py-2 px-2 font-bold">Devis</th>
                  <th className="text-left py-2 px-2 font-bold">Client</th>
                  <th className="text-right py-2 px-2 font-bold">Montant</th>
                  <th className="text-right py-2 px-2 font-bold">Proba</th>
                  <th className="text-right py-2 px-2 font-bold">Pondéré</th>
                  <th className="text-left py-2 px-2 font-bold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {devis.map(d => (
                  <tr key={d.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                    <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[260px]">{d.title}</td>
                    <td className="py-2 px-2 text-[#888] text-xs truncate max-w-[140px]">{d.canonical_client || d.company_name}</td>
                    <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(d.amount)}</td>
                    <td className="py-2 px-2 text-right text-xs font-bold" style={{ color: d.probability >= 70 ? '#2ecc71' : d.probability >= 40 ? '#f39c12' : '#888' }}>{d.probability}%</td>
                    <td className="py-2 px-2 text-right font-bold text-[#3b82f6]">{fmtK(d.probabilise)}</td>
                    <td className="py-2 px-2 text-xs text-[#888]">{d.pipe_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#3b82f6]/20 bg-[#3b82f6]/5 font-bold">
                  <td className="py-2 px-2 text-white text-xs" colSpan={2}>TOTAL ({devis.length})</td>
                  <td className="py-2 px-2 text-right text-[#ccc] text-xs">{fmtK(totals.pipeBrut)}</td>
                  <td />
                  <td className="py-2 px-2 text-right text-[#3b82f6]">{fmtK(totals.pipe)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
