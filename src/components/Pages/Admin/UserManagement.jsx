import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, UserCog } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ login: '', password: '', name: '', role: 'dc', furiousName: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = async () => {
    try {
      const data = await apiFetch('/api/admin/users');
      setUsers(data.users || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const resetForm = () => {
    setForm({ login: '', password: '', name: '', role: 'dc', furiousName: '' });
    setEditing(null);
    setShowNew(false);
    setError('');
  };

  const handleCreate = async () => {
    setError('');
    try {
      await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setSuccess('Utilisateur cree');
      resetForm();
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.message); }
  };

  const handleUpdate = async () => {
    setError('');
    const updates = { ...form };
    if (!updates.password) delete updates.password;
    try {
      await apiFetch(`/api/admin/users/${editing}`, { method: 'PUT', body: JSON.stringify(updates) });
      setSuccess('Utilisateur modifie');
      resetForm();
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Supprimer l'utilisateur "${name}" ?`)) return;
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      loadUsers();
    } catch (e) { setError(e.message); }
  };

  const startEdit = (user) => {
    setEditing(user.id);
    setForm({ login: user.login, password: '', name: user.name, role: user.role, furiousName: user.furiousName || '' });
    setShowNew(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Gestion des Directeurs de Clientele</h2>
        <button onClick={() => { resetForm(); setShowNew(true); }}
          className="flex items-center gap-2 bg-[#e63946] hover:bg-[#d62836] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          <Plus size={16} /> Nouveau DC
        </button>
      </div>

      {success && <div className="bg-[#2ecc71]/10 border border-[#2ecc71]/30 rounded-lg px-4 py-2 text-sm text-[#2ecc71]">{success}</div>}
      {error && <div className="bg-[#e63946]/10 border border-[#e63946]/30 rounded-lg px-4 py-2 text-sm text-[#e63946]">{error}</div>}

      {/* Form */}
      {showNew && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#888] uppercase mb-4">{editing ? 'Modifier' : 'Nouveau'} Utilisateur</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#888] uppercase mb-1">Login</label>
              <input type="text" value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[#888] uppercase mb-1">Mot de passe {editing && '(laisser vide = inchange)'}</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[#888] uppercase mb-1">Nom complet</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[#888] uppercase mb-1">Nom Furious (exacte correspondance)</label>
              <input type="text" value={form.furiousName} onChange={e => setForm(f => ({ ...f, furiousName: e.target.value }))}
                placeholder="Ex: Jean Dupont"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[#888] uppercase mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#e63946] focus:outline-none">
                <option value="dc">Directeur de Clientele</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={editing ? handleUpdate : handleCreate}
              className="flex items-center gap-2 bg-[#2ecc71] hover:bg-[#27ae60] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              <Save size={16} /> {editing ? 'Enregistrer' : 'Creer'}
            </button>
            <button onClick={resetForm}
              className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#333] text-[#888] px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              <X size={16} /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5">
        {loading ? <p className="text-[#888] text-sm text-center py-8">Chargement...</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left px-3 py-3 text-xs font-bold uppercase text-[#888]">Nom</th>
                <th className="text-left px-3 py-3 text-xs font-bold uppercase text-[#888]">Login</th>
                <th className="text-left px-3 py-3 text-xs font-bold uppercase text-[#888]">Role</th>
                <th className="text-left px-3 py-3 text-xs font-bold uppercase text-[#888]">Nom Furious</th>
                <th className="text-left px-3 py-3 text-xs font-bold uppercase text-[#888]">Dernier acces</th>
                <th className="text-right px-3 py-3 text-xs font-bold uppercase text-[#888]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="px-3 py-3 text-white font-medium">{u.name}</td>
                  <td className="px-3 py-3 text-[#ccc]">{u.login}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase
                      ${u.role === 'admin' ? 'bg-[#e63946]/20 text-[#e63946]' : 'bg-[#3b82f6]/20 text-[#3b82f6]'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#888]">{u.furiousName || '—'}</td>
                  <td className="px-3 py-3 text-[#888] text-xs">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : 'Jamais'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(u)} className="p-1.5 text-[#888] hover:text-[#3b82f6] transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 text-[#888] hover:text-[#e63946] transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
