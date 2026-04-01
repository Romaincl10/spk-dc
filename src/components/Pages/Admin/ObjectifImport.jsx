import { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { apiFetch, apiUpload } from '../../../utils/api';
import DataTable from '../../Common/DataTable';

export default function ObjectifImport() {
  const [objectives, setObjectives] = useState({});
  const [imports, setImports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const loadData = async () => {
    try {
      const data = await apiFetch('/api/data/objectives');
      setObjectives(data.objectives || {});
      setImports(data.imports || []);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await apiUpload('/api/admin/objectives/import', formData);
      setResult(data);
      loadData();
      fileRef.current.value = '';
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  };

  // Flatten objectives for table display
  const allObjs = Object.entries(objectives).flatMap(([dc, objs]) =>
    objs.map(o => ({ dc, ...o }))
  );

  const columns = [
    { key: 'dc', label: 'DC', width: '20%' },
    { key: 'label', label: 'Objectif' },
    { key: 'target', label: 'Cible', render: v => <span className="font-bold text-white">{v}</span> },
    { key: 'type', label: 'Type', render: v => <span className="text-xs bg-[#2a2a2a] px-2 py-0.5 rounded">{v}</span> },
    { key: 'period', label: 'Periode' },
  ];

  const downloadTemplate = () => {
    const csv = 'DC;Objectif;Cible;Type;Periode\nJean Dupont;CA Annuel;500000;ca_annuel;2025-2026\nJean Dupont;Nombre de clients actifs;15;nb_clients;2025-2026\nJean Dupont;Marge brute moyenne;35;marge_moyenne;2025-2026';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_objectifs_spk_dc.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-white">Import Objectifs</h2>

      {/* Upload zone */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <FileSpreadsheet size={24} className="text-[#888] mt-1" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-1">Importer un fichier CSV</h3>
            <p className="text-xs text-[#888] mb-3">
              Format attendu : DC;Objectif;Cible;Type;Periode<br />
              Types : ca_annuel, nb_clients, marge_moyenne, nb_projets, taux_signature
            </p>
            <div className="flex items-center gap-3">
              <input type="file" ref={fileRef} accept=".csv,.txt" className="text-sm text-[#888] file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#2a2a2a] file:text-white file:font-semibold file:text-sm file:cursor-pointer hover:file:bg-[#333]" />
              <button onClick={handleUpload} disabled={uploading}
                className="flex items-center gap-2 bg-[#e63946] hover:bg-[#d62836] text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors">
                <Upload size={16} /> {uploading ? 'Import...' : 'Importer'}
              </button>
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#333] text-[#888] px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                <Download size={16} /> Template
              </button>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-4 flex items-center gap-2 bg-[#2ecc71]/10 border border-[#2ecc71]/30 rounded-lg px-4 py-2">
            <CheckCircle size={16} className="text-[#2ecc71]" />
            <span className="text-sm text-[#2ecc71]">
              {result.count} objectifs importes pour {result.dcs?.length} DC : {result.dcs?.join(', ')}
            </span>
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-2 bg-[#e63946]/10 border border-[#e63946]/30 rounded-lg px-4 py-2">
            <AlertCircle size={16} className="text-[#e63946]" />
            <span className="text-sm text-[#e63946]">{error}</span>
          </div>
        )}
      </div>

      {/* Current objectives */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-4">Objectifs en cours ({allObjs.length})</h3>
        <DataTable columns={columns} data={allObjs} pageSize={20} />
      </div>

      {/* Import history */}
      {imports.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#888] uppercase tracking-wider mb-4">Historique des imports</h3>
          <div className="space-y-2">
            {imports.slice().reverse().slice(0, 10).map((imp, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                <div>
                  <span className="text-sm text-[#ccc]">{imp.count} objectifs</span>
                  <span className="text-xs text-[#888] ml-2">({imp.dcs?.join(', ')})</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#888]">{new Date(imp.date).toLocaleString('fr-FR')}</span>
                  <span className="text-xs text-[#555] ml-2">par {imp.by}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
