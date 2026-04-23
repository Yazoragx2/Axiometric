import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Save, Trash2, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';

export function SettingsTab() {
  // REPLACED: Transitioned from Firestore to LocalStorage for persistence and safe local storage
  const [settings, setSettingsState] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('axiometric_settings');
      return saved ? JSON.parse(saved) : { model: 'qwen/qwen-plus', hourlyRate: '' };
    } catch (e) { return { model: 'qwen/qwen-plus', hourlyRate: '' }; }
  });
  
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string}>>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [vaultApiKey, setVaultApiKey] = useState('');
  const [hasVaultKey, setHasVaultKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  useEffect(() => {
    window.electronAPI.getModels().then(setAvailableModels).catch(console.error);
    if (window.electronAPI.checkApiKey) {
      window.electronAPI.checkApiKey().then((hasKey: boolean) => setHasVaultKey(hasKey)).catch(console.error);
    }
    if (settings) {
      setModel(settings.model || 'qwen/qwen-plus');
      setHourlyRate(settings.hourlyRate || '');
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      const newSettings = { model, hourlyRate };
      setSettingsState(newSettings);
      localStorage.setItem('axiometric_settings', JSON.stringify(newSettings));
      
      // Save Vault Key if provided
      if (vaultApiKey.trim() && window.electronAPI.saveApiKey) {
        const result = await window.electronAPI.saveApiKey(vaultApiKey.trim());
        if (result.error) throw new Error(result.error);
        setHasVaultKey(true);
        setVaultApiKey(''); // clear field after secure save
      }

      // Notify other components (like ChatWidget) in the same tab
      window.dispatchEvent(new CustomEvent('axiometric_local_update'));
      
      setStatus({ type: 'success', message: 'Settings saved locally!' });
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to save settings' });
    }
  };

  // Key deletion removed, handled by main process instead

  if (loading) return <div className="p-8 text-center text-muted">Loading settings...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card" 
        style={{ padding: 32, position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.03 }}>
          <ShieldCheck size={200} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--accent-dim)', padding: 10, borderRadius: 8, color: 'var(--accent)' }}>
            <Key size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>User Settings</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Manage your API keys and session preferences</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={{ paddingBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Secure API Vault (OpenRouter)
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input 
                type="password"
                value={vaultApiKey} 
                onChange={(e) => setVaultApiKey(e.target.value)}
                placeholder={hasVaultKey ? "••••••••••••••••••••••••••••••••" : "sk-or-v1-..."}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
              {hasVaultKey && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-green)', fontSize: 12, fontWeight: 500 }}>
                  <ShieldCheck size={16} /> Vault Secured
                </div>
              )}
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Enter your API key to encode it directly into the desktop's native <code style={{color:'var(--accent)'}}>ai_key.enc</code> vault. The key is encrypted and strictly non-extractable.
            </p>
          </section>

          <section>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Model Provider
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <select 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', appearance: 'none' }}
                >
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                  ▼
                </div>
              </div>
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Your API key is securely encrypted and managed by the desktop application via Windows Credential Manager.
            </p>
          </section>

          <section>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Hourly Rate ($)
            </label>
            <input 
              type="number" 
              value={hourlyRate} 
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g. 25.00"
              style={{ maxWidth: 200 }}
            />
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Used for calculating your projected pay in the Hours & Pay tracker.
            </p>
          </section>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <button onClick={handleSave} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}>
              <Save size={16} /> Save Changes
            </button>

            {status.type !== 'idle' && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  fontSize: 13, 
                  color: status.type === 'success' ? 'var(--status-green)' : 'var(--status-red)' 
                }}
              >
                {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {status.message}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
