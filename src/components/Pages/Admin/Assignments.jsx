import { useState, useEffect, useMemo } from 'react';
import { Search, Users, FolderKanban, FileText, CheckCircle, AlertTriangle, History, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { fmtK } from '../../../utils/format';

const fyLabel = (y) => `${String(y).slice(2)}/${String(y + 1).slice(2)}`;

export default function Assignments({ onAssigned, fyStartYear, onFyChange, currentFyStartYear }) {
  const [tab, setTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [dcs, setDcs] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, assigned, unassigned
  const [saving, setSaving] = useState(null);
  const fy = fyStartYear ?? currentFyStartYear;
  const fyYears = [currentFyStartYear - 1, currentFyStartYear];

  const loadClients = async () => {
    try {
      const data = await apiFetch(`/api/admin/all-clients?fy=${fy}`);
      setClients(data.clients || []);
      setDcs(data.dcs || []);
    } catch (e) { console.error(e); }
  };

  const loadProjects = async () => {
    try {
      const data = await apiFetch(`/api/admin/all-projects?fy=${fy}`);
      setProjects(data.projects || []);
      if (data.dcs?.length) setDcs(data.dcs);
    } catch (e) { console.error(e); }
  };

  const loadProposals = async () => {
    try {
      const data = await apiFetch(`/api/admin/all-proposals?fy=${fy}`);
      setProposals(data.proposals || []);
      if (data.dcs?.length) setDcs(data.dcs);
    } catch (e) { console.error(e); }
  };

  const [history, setHistory] = useState([]);
  const loadHistory = async () => {
    try {
      const data = await apiFetch('/api/admin/assignments/history?limit=500');
      setHistory(data.history || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadClients(); loadProjects(); loadProposals(); }, [fy]);
  useEffect(() => { loadHistory(); }, []);

  // dcName='' + removeOverride=true → revient à la valeur héritée du défaut pour cet exercice
  const handleAssignClient = async (clientName, dcName, removeOverride = false) => {
    setSaving(clientName);
    try {
      await apiFetch('/api/admin/assignments/client', {
        method: 'PUT', body: JSON.stringify({ clientName, dcName, fyStartYear: fy, removeOverride }),
      });
      await loadClients();
      loadHistory();
      onAssigned?.();
    } catch (e) { console.error(e); }
    setSaving(null);
  };

  const handleAssignProject = async (projectId, dcNames) => {
    setSaving(projectId);
    try {
      await apiFetch('/api/admin/assignments/project', {
        method: 'PUT', body: JSON.stringify({ projectId, dcNames }),
      });
      setProjects(prev => prev.map(p => p.id === projectId
        ? { ...p, assignedDCs: dcNames, source: dcNames.length ? 'project' : 'none' }
        : p));
      onAssigned?.();
    } catch (e) { console.error(e); }
    setSaving(null);
  };

  const handleAssignProposal = async (proposalId, dcNames) => {
    setSaving(proposalId);
    try {
      await apiFetch('/api/admin/assignments/proposal', {
        method: 'PUT', body: JSON.stringify({ proposalId, dcNames }),
      });
      setProposals(prev => prev.map(p => p.id === proposalId
        ? { ...p, assignedDCs: dcNames, source: dcNames.length ? 'proposal' : 'none' }
        : p));
      onAssigned?.();
    } catch (e) { console.error(e); }
    setSaving(null);
  };

  // Filtered clients
  const filteredClients = useMemo(() => {
    let list = clients;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s));
    }
    if (filter === 'assigned') list = list.filter(c => c.dc);
    if (filter === 'unassigned') list = list.filter(c => !c.dc);
    return list;
  }, [clients, search, filter]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let list = projects;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => (p.title || '').toLowerCase().includes(s) || (p.company_name || '').toLowerCase().includes(s));
    }
    if (filter === 'assigned') list = list.filter(p => p.assignedDCs?.length > 0);
    if (filter === 'unassigned') list = list.filter(p => !p.assignedDCs?.length);
    return list;
  }, [projects, search, filter]);

  // Filtered proposals (devis)
  const filteredProposals = useMemo(() => {
    let list = proposals;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => (p.title || '').toLowerCase().includes(s) || (p.company_name || '').toLowerCase().includes(s));
    }
    if (filter === 'assigned') list = list.filter(p => p.assignedDCs?.length > 0);
    if (filter === 'unassigned') list = list.filter(p => !p.assignedDCs?.length);
    return list;
  }, [proposals, search, filter]);

  const unassignedClientCount = clients.filter(c => !c.dc).length;
  const unassignedProjectCount = projects.filter(p => !p.assignedDCs?.length).length;
  const unassignedProposalCount = proposals.filter(p => !p.assignedDCs?.length).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-white">Assignations Client / Projet / Devis</h2>
        {/* Sélecteur d'exercice — l'assignation client est datée par exercice */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#888] font-semibold uppercase tracking-wider">Exercice</span>
          <div className="flex gap-1 bg-[#161616] rounded-lg p-1">
            {fyYears.map(y => (
              <button key={y} onClick={() => onFyChange?.(y)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors
                  ${fy === y ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>
                {fyLabel(y)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {tab === 'clients' && (
        <p className="text-[11px] text-[#666] -mt-3">
          L'affectation client vaut pour l'exercice <span className="text-[#aaa] font-semibold">{fyLabel(fy)}</span>.
          Une valeur <span className="text-[#3b82f6]">datée</span> prime sur la valeur <span className="text-[#888]">héritée</span> (défaut commun aux exercices) — de quoi gérer une passation sans réécrire l'historique.
        </p>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-[#161616] rounded-lg p-1">
          <button onClick={() => { setTab('clients'); setSearch(''); setFilter('all'); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-colors
              ${tab === 'clients' ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>
            <Users size={16} /> Clients
            {unassignedClientCount > 0 && (
              <span className="bg-[#f39c12] text-black text-[10px] font-bold px-1.5 rounded-full">{unassignedClientCount}</span>
            )}
          </button>
          <button onClick={() => { setTab('projects'); setSearch(''); setFilter('all'); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-colors
              ${tab === 'projects' ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>
            <FolderKanban size={16} /> Projets
            {unassignedProjectCount > 0 && (
              <span className="bg-[#f39c12] text-black text-[10px] font-bold px-1.5 rounded-full">{unassignedProjectCount}</span>
            )}
          </button>
          <button onClick={() => { setTab('proposals'); setSearch(''); setFilter('all'); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-colors
              ${tab === 'proposals' ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>
            <FileText size={16} /> Devis
            {unassignedProposalCount > 0 && (
              <span className="bg-[#f39c12] text-black text-[10px] font-bold px-1.5 rounded-full">{unassignedProposalCount}</span>
            )}
          </button>
          <button onClick={() => { setTab('history'); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-colors
              ${tab === 'history' ? 'bg-[#e63946] text-white' : 'text-[#888] hover:text-white'}`}>
            <History size={16} /> Historique
          </button>
        </div>

        <div className="flex gap-1 bg-[#161616] rounded-lg p-1">
          {[{ id: 'all', label: 'Tous' }, { id: 'unassigned', label: 'A assigner' }, { id: 'assigned', label: 'Assignes' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors
                ${filter === f.id ? 'bg-[#2a2a2a] text-white' : 'text-[#888] hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-[#161616] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none w-48" />
        </div>
      </div>

      {/* CLIENT ASSIGNMENTS */}
      {tab === 'clients' && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <div className="text-xs text-[#888] mb-3">{filteredClients.length} clients</div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {filteredClients.map(c => (
              <div key={c.name} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors
                ${!c.dc ? 'bg-[#f39c12]/5 border border-[#f39c12]/20' : 'hover:bg-[#1a1a1a]'}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate block">{c.name}</span>
                </div>
                {/* Source de la valeur : datée (override exercice) vs héritée (défaut) */}
                {c.dc && c.dcSource === 'year' && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#3b82f6]/15 text-[#3b82f6] shrink-0">datée {fyLabel(fy)}</span>
                )}
                {c.dc && c.dcSource === 'default' && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#888] shrink-0">héritée</span>
                )}
                {c.dcSource === 'year' && (
                  <button onClick={() => handleAssignClient(c.name, '', true)} title="Revenir à la valeur héritée"
                    className="text-[#666] hover:text-[#e63946] text-xs shrink-0">↺</button>
                )}
                {!c.dc && <AlertTriangle size={14} className="text-[#f39c12] shrink-0" />}
                <select
                  value={c.dc || ''}
                  onChange={e => handleAssignClient(c.name, e.target.value)}
                  className={`bg-[#0a0a0a] border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-[#e63946] w-36
                    ${c.dc ? 'border-[#2a2a2a] text-white' : 'border-[#f39c12]/50 text-[#f39c12]'}`}>
                  <option value="">A assigner</option>
                  {dcs.filter(d => d !== 'A assigner').map(dc => (
                    <option key={dc} value={dc}>{dc}</option>
                  ))}
                </select>
                {saving === c.name && <div className="w-4 h-4 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROJECT ASSIGNMENTS */}
      {tab === 'projects' && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <div className="text-xs text-[#888] mb-3">{filteredProjects.length} projets</div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {filteredProjects.map(p => {
              const currentDC = p.assignedDCs?.[0] || '';
              const isUnassigned = !p.assignedDCs?.length;
              return (
                <div key={p.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors
                  ${isUnassigned ? 'bg-[#f39c12]/5 border border-[#f39c12]/20' : 'hover:bg-[#1a1a1a]'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.title}</p>
                    <p className="text-xs text-[#888]">{p.company_name} — {fmtK(p.total_amount)}</p>
                  </div>
                  {p.source === 'client' && (
                    <span className="text-[10px] text-[#555] bg-[#2a2a2a] px-1.5 py-0.5 rounded shrink-0">via client</span>
                  )}
                  {isUnassigned && <AlertTriangle size={14} className="text-[#f39c12] shrink-0" />}
                  <select
                    value={p.source === 'project' ? currentDC : (p.source === 'client' ? `_client:${currentDC}` : '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.startsWith('_client:')) return; // Don't save client-inherited
                      handleAssignProject(p.id, val ? [val] : []);
                    }}
                    className={`bg-[#0a0a0a] border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-[#e63946] w-36
                      ${!isUnassigned ? 'border-[#2a2a2a] text-white' : 'border-[#f39c12]/50 text-[#f39c12]'}`}>
                    <option value="">{p.source === 'client' ? `(${currentDC} via client)` : 'A assigner'}</option>
                    {dcs.filter(d => d !== 'A assigner').map(dc => (
                      <option key={dc} value={dc}>{dc}</option>
                    ))}
                  </select>
                  {saving === p.id && <div className="w-4 h-4 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PROPOSAL (DEVIS) ASSIGNMENTS */}
      {tab === 'proposals' && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <div className="text-xs text-[#888] mb-3">{filteredProposals.length} devis en cours</div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {filteredProposals.map(p => {
              const currentDC = p.assignedDCs?.[0] || '';
              const isUnassigned = !p.assignedDCs?.length;
              return (
                <div key={p.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors
                  ${isUnassigned ? 'bg-[#f39c12]/5 border border-[#f39c12]/20' : 'hover:bg-[#1a1a1a]'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.title}</p>
                    <p className="text-xs text-[#888]">
                      {p.company_name} — {fmtK(p.amount)}
                      {p.probability ? ` · ${p.probability}%` : ''}
                      {p.pipe_name ? ` · ${p.pipe_name}` : ''}
                    </p>
                  </div>
                  {p.source === 'client' && (
                    <span className="text-[10px] text-[#555] bg-[#2a2a2a] px-1.5 py-0.5 rounded shrink-0">via client</span>
                  )}
                  {isUnassigned && <AlertTriangle size={14} className="text-[#f39c12] shrink-0" />}
                  <select
                    value={p.source === 'proposal' ? currentDC : (p.source === 'client' ? `_client:${currentDC}` : '')}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.startsWith('_client:')) return; // Don't save client-inherited
                      handleAssignProposal(p.id, val ? [val] : []);
                    }}
                    className={`bg-[#0a0a0a] border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-[#e63946] w-36
                      ${!isUnassigned ? 'border-[#2a2a2a] text-white' : 'border-[#f39c12]/50 text-[#f39c12]'}`}>
                    <option value="">{p.source === 'client' ? `(${currentDC} via client)` : 'A assigner'}</option>
                    {dcs.filter(d => d !== 'A assigner').map(dc => (
                      <option key={dc} value={dc}>{dc}</option>
                    ))}
                  </select>
                  {saving === p.id && <div className="w-4 h-4 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* HISTORIQUE DES ASSIGNATIONS */}
      {tab === 'history' && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
            <p className="text-sm font-bold text-white flex items-center gap-2"><History size={15} /> Journal des assignations</p>
            <span className="text-[11px] text-[#666]">{history.length} mouvement{history.length > 1 ? 's' : ''}</span>
          </div>
          {history.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[#888]">Aucun changement enregistré pour l'instant.</p>
              <p className="text-xs text-[#555] mt-1">Le journal démarre à l'activation : il tracera chaque future assignation (qui, quand, ancien DC vers nouveau).</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1c1c1c] max-h-[60vh] overflow-y-auto">
              {history
                .filter(h => !search || (h.target || '').toLowerCase().includes(search.toLowerCase()) || (h.actor || '').toLowerCase().includes(search.toLowerCase()) || (h.to || '').toLowerCase().includes(search.toLowerCase()))
                .map((h, i) => {
                  const typeLabel = h.type === 'client' ? 'Client' : h.type === 'project' ? 'Projet' : 'Devis';
                  const typeColor = h.type === 'client' ? '#06b6d4' : h.type === 'project' ? '#8b5cf6' : '#f39c12';
                  const d = h.ts ? new Date(h.ts) : null;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a1a1a]">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0" style={{ color: typeColor, backgroundColor: `${typeColor}1a` }}>{typeLabel}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{h.target}</p>
                        <p className="text-[11px] text-[#888] flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#aaa]">{h.from || '(à assigner)'}</span>
                          <ArrowRight size={11} className="text-[#555]" />
                          <span className="font-bold text-white">{h.to || '(à assigner)'}</span>
                          {h.fy != null && <span className="text-[#555]">· exercice {fyLabel(h.fy)}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-[#ccc]">{h.actor}</p>
                        <p className="text-[10px] text-[#666]">{d ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
