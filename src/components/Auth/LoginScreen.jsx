import { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { setSession } from '../../utils/api';

export default function LoginScreen({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
      setSession(data);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold italic text-white tracking-tight">SPK <span className="text-[#e63946]">DC</span></h1>
          <p className="text-[#888] text-sm mt-2 font-light">Portail Directeurs de Clientele</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-[#e63946]/10 border border-[#e63946]/30 rounded-lg px-3 py-2">
              <AlertCircle size={16} className="text-[#e63946]" />
              <span className="text-sm text-[#e63946]">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-[#888] tracking-wider mb-1">Identifiant</label>
            <input type="text" value={login} onChange={e => setLogin(e.target.value)} required autoFocus
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-sm focus:border-[#e63946] focus:outline-none transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#888] tracking-wider mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-sm focus:border-[#e63946] focus:outline-none transition-colors" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#e63946] hover:bg-[#d62836] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
            <LogIn size={18} />
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-[#555] text-xs mt-6 font-light">SPK Group &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
