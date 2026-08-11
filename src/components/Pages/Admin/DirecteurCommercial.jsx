import { useState, useEffect } from 'react';
import { Crosshair, TrendingUp, Briefcase, FileText, ChevronRight, Sparkles } from 'lucide-react';
import KPICard from '../../Common/KPICard';
import { apiFetch } from '../../../utils/api';
import { fmtK, fmtPct } from '../../../utils/format';
import { formatDate } from '../../../utils/dateRange';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;

export default function DirecteurCommercial({ fyStartYear }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // client name pour le détail

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelected(null);
    apiFetch(`/api/data/biz-dev?fy=${fyStartYear}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { console.error('[BizDev]', e); if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fyStartYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const clients = data?.clients || [];
  const totals = data?.totals || { count: 0, caSigne: 0, mbEur: 0, pipe: 0, projects: 0, devis: 0, margePct: 0 };
  const selectedClient = selected ? clients.find(c => c.name === selected) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center">
          <Crosshair size={20} className="text-[#8b5cf6]" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold italic text-white">Paul — Biz Dev · Nouveaux clients</h2>
          <p className="text-[#888] text-sm">
            Sociétés jamais mouvementées auparavant, entrées en relation sur l'exercice {fyLabel(fyStartYear)}
          </p>
        </div>
      </div>

      {/* KPIs Biz Dev */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Nouveaux clients" value={totals.count} icon={<Sparkles size={16} />} color="text-[#8b5cf6]" />
        <KPICard label="CA signé" value={totals.caSigne} suffix="€"
          subtitle={`MB ${fmtPct(totals.margePct || 0)}`} />
        <KPICard label="Pipe pondéré" value={totals.pipe} suffix="€" color="text-[#3b82f6]" />
        <KPICard label="Projets / Devis" value={totals.projects} suffix={` / ${totals.devis}`} />
      </div>

      {clients.length === 0 ? (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-10 text-center">
          <Sparkles size={28} className="text-[#444] mx-auto mb-3" />
          <p className="text-[#888] text-sm">Aucun nouveau client sur l'exercice {fyLabel(fyStartYear)} pour l'instant.</p>
          <p className="text-[#555] text-xs mt-1">Un client est « nouveau » si son tout premier projet ou sa première facture tombe dans cet exercice.</p>
        </div>
      ) : (
        <>
          {/* Tableau des nouveaux clients */}
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 md:p-5">
            <h3 className="text-sm font-bold text-[#ccc] uppercase tracking-wider mb-4">
              Portefeuille des nouveaux clients ({clients.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-[#888] text-xs uppercase tracking-wide border-b border-[#2a2a2a]">
                    <th className="text-left font-semibold py-2 pr-3">Client</th>
                    <th className="text-left font-semibold py-2 px-2">Entrée</th>
                    <th className="text-right font-semibold py-2 px-2">CA signé</th>
                    <th className="text-right font-semibold py-2 px-2">MB%</th>
                    <th className="text-right font-semibold py-2 px-2">Pipe pondéré</th>
                    <th className="text-right font-semibold py-2 px-2">Projets</th>
                    <th className="text-right font-semibold py-2 pl-2">Devis</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const isSel = selected === c.name;
                    return (
                      <tr key={c.name}
                        onClick={() => setSelected(isSel ? null : c.name)}
                        className={`border-b border-[#1a1a1a] cursor-pointer transition-colors ${isSel ? 'bg-[#8b5cf6]/10' : 'hover:bg-[#1a1a1a]'}`}>
                        <td className="py-2.5 pr-3 font-semibold text-white">{c.name}</td>
                        <td className="py-2.5 px-2 text-[#888] text-xs">{formatDate(c.firstMove)}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-white">{fmtK(c.caSigne)}</td>
                        <td className="py-2.5 px-2 text-right">
                          {c.caSigne > 0
                            ? <span style={{ color: c.margePct >= 54 ? '#2ecc71' : c.margePct >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(c.margePct)}</span>
                            : <span className="text-[#555]">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#3b82f6] font-medium">{c.pipe > 0 ? fmtK(c.pipe) : '—'}</td>
                        <td className="py-2.5 px-2 text-right text-[#ccc]">{c.projects.length}</td>
                        <td className="py-2.5 pl-2 text-right text-[#ccc]">{c.devis.length}</td>
                        <td className="py-2.5 text-right">
                          <ChevronRight size={15} className={`text-[#555] transition-transform ${isSel ? 'rotate-90' : ''}`} />
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[#8b5cf6]/40 bg-[#8b5cf6]/5 font-bold">
                    <td className="py-2.5 pr-3 text-white" colSpan={2}>TOTAL ({totals.count})</td>
                    <td className="py-2.5 px-2 text-right text-white">{fmtK(totals.caSigne)}</td>
                    <td className="py-2.5 px-2 text-right text-[#888]">{fmtPct(totals.margePct || 0)}</td>
                    <td className="py-2.5 px-2 text-right text-[#3b82f6]">{fmtK(totals.pipe)}</td>
                    <td className="py-2.5 px-2 text-right text-[#ccc]">{totals.projects}</td>
                    <td className="py-2.5 pl-2 text-right text-[#ccc]">{totals.devis}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[#555] text-[11px] mt-3">
              Clients médias (deals MED0 : footpack, runpack, velopack…) sont suivis dans l'onglet <span className="text-[#8b5cf6]">Médias</span>, pas ici.
            </p>
          </div>

          {/* Détail du client sélectionné */}
          {selectedClient && (
            <div className="space-y-4">
              {selectedClient.projects.length > 0 && (
                <div className="bg-[#161616] border border-[#8b5cf6]/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase size={16} className="text-[#8b5cf6]" />
                    <h3 className="text-sm font-bold text-white">Projets — {selectedClient.name}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 bg-[#8b5cf6]/20 text-[#8b5cf6] rounded-full ml-auto">{selectedClient.projects.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                          <th className="text-left py-2 px-2 font-bold">Projet</th>
                          <th className="text-right py-2 px-2 font-bold">CA Net</th>
                          <th className="text-right py-2 px-2 font-bold">MB%</th>
                          <th className="text-left py-2 px-2 font-bold">Période</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClient.projects.map(p => (
                          <tr key={p.id} className="border-b border-[#1a1a1a]">
                            <td className="py-2 px-2 text-white font-medium text-xs truncate max-w-[280px]">{p.title}</td>
                            <td className="py-2 px-2 text-right font-bold text-white">{fmtK(p.total_amount)}</td>
                            <td className="py-2 px-2 text-right text-xs" style={{ color: p.margin >= 54 ? '#2ecc71' : p.margin >= 45 ? '#f39c12' : '#e74c3c' }}>{fmtPct(p.margin)}</td>
                            <td className="py-2 px-2 text-xs text-[#888]">{formatDate(p.start_date)} → {formatDate(p.end_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedClient.devis.length > 0 && (
                <div className="bg-[#161616] border border-[#3b82f6]/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-[#3b82f6]" />
                    <h3 className="text-sm font-bold text-white">Devis en cours — {selectedClient.name}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full ml-auto">{selectedClient.devis.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a2a2a] text-[10px] uppercase text-[#888]">
                          <th className="text-left py-2 px-2 font-bold">Devis</th>
                          <th className="text-right py-2 px-2 font-bold">Montant</th>
                          <th className="text-right py-2 px-2 font-bold">Proba</th>
                          <th className="text-right py-2 px-2 font-bold">Pondéré</th>
                          <th className="text-left py-2 px-2 font-bold">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClient.devis.map(d => (
                          <tr key={d.id} className="border-b border-[#1a1a1a]">
                            <td className="py-2 px-2 text-[#3b82f6] font-medium text-xs italic truncate max-w-[280px]">{d.title}</td>
                            <td className="py-2 px-2 text-right text-[#ccc]">{fmtK(d.amount)}</td>
                            <td className="py-2 px-2 text-right text-xs font-bold" style={{ color: d.probability >= 70 ? '#2ecc71' : d.probability >= 40 ? '#f39c12' : '#888' }}>{d.probability}%</td>
                            <td className="py-2 px-2 text-right font-bold text-[#3b82f6]">{fmtK(d.probabilise)}</td>
                            <td className="py-2 px-2 text-xs text-[#888]">{d.pipe_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
