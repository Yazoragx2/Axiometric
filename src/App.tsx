import React, { useState, useEffect } from 'react';
import { CatalogProvider } from './CatalogContext';
import { DashboardTab } from './components/DashboardTab';
import { SessionStartTab } from './components/SessionStartTab';
import { CompetencyTracker } from './components/CompetencyTracker';
import { SessionCloseTab } from './components/SessionCloseTab';
import { DocumentStore } from './components/DocumentStore';
import { DailyWorkSummary } from './components/DailyWorkSummary';
import { HoursPayTracker } from './components/HoursPayTracker';
import { BossQueueReviewAndPerplexity } from './components/BossQueueReviewAndPerplexity';
import { MasterplanTab } from './components/MasterplanTab';
import { SettingsTab } from './components/SettingsTab';
import { TeamSharingTab } from './components/TeamSharingTab';
import { ChatWidget } from './components/ChatWidget';
import { RubricAgentModule } from './components/agent/RubricAgentModule';
import { Auth } from './components/Auth';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useFirestoreDoc } from './hooks/useFirestore';
import { usePermissions } from './hooks/usePermissions';
import { TIMER_KEY } from './constants';
import { formatDate, todayStr, fmtHHMMSS } from './utils';

import { Logo } from './components/Logo';
import { MessageSquare, X, Settings, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_GROUPS = [
  { label: 'Session', tabs: [
    { id: 'dashboard',     label: 'Dashboard' },
    { id: 'session-start', label: 'Session Start' },
    { id: 'session-close', label: 'Session Close' },
  ]},
  { label: 'Tracking', tabs: [
    { id: 'competency-tracker', label: 'Competency Tracker' },
    { id: 'hours-pay',          label: 'Hours & Pay' },
    { id: 'jake-queue',         label: 'Boss’s Queue' },
  ]},
  { label: 'Records', tabs: [
    { id: 'document-store', label: 'Document Store' },
    { id: 'daily-summary',  label: 'Daily Summary' },
  ]},
  { label: 'Project', tabs: [
    { id: 'masterplan',   label: 'Masterplan' },
    { id: 'team-sharing', label: 'Team Sharing' },
    { id: 'settings',     label: 'Settings' },
  ]},
];

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeModule, setActiveModule] = useState<'core' | 'agent'>('core');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { isAdmin } = usePermissions();
  const { data: timerState } = useFirestoreDoc<any>('timer', 'current', { running: false, startTimestamp: null, label: '', elapsedAtStop: 0 });
  const [settings, setSettings] = useState<{apiKey: string}>(() => {
    try {
      const saved = localStorage.getItem('axiometric_settings');
      return saved ? JSON.parse(saved) : { apiKey: '' };
    } catch (e) { return { apiKey: '' }; }
  });
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<any>(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('axiometric_settings');
        if (saved) setSettings(JSON.parse(saved));
      } catch (e) { console.error("Failed to sync settings:", e); }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('axiometric_local_update', handleStorage);
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('axiometric_local_update', handleStorage);
    };
  }, [refreshKey]);

  const handleAuthenticated = (u: any) => {
    setUser(u);
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    if (!timerState) return;
    
    const updateTimer = () => {
      if (timerState.running && timerState.startTimestamp) {
        setTimerElapsed(Math.floor((Date.now() - timerState.startTimestamp) / 1000) + (timerState.elapsedAtStop || 0));
      } else {
        setTimerElapsed(timerState.elapsedAtStop || 0);
      }
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [timerState]);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('navigate', handleNavigate);
    
    // Auto-update status listener
    if (window.electronAPI && window.electronAPI.onUpdateStatus) {
      window.electronAPI.onUpdateStatus((status: any) => {
        if (status.type === 'available') setUpdateStatus('available');
        if (status.type === 'progress') setUpdateProgress(status.percent);
        if (status.type === 'downloaded') setUpdateStatus('downloaded');
        if (status.type === 'error') setUpdateError(status.message);
      });
    }

    return () => {
      window.removeEventListener('navigate', handleNavigate);
    };
  }, []);

  if (!authReady) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-muted)' }}>Initializing...</div>;
  }

  if (!user || !user.emailVerified) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'transparent' }}>
      {/* Auto-Updater Banner */}
      <AnimatePresence>
        {(updateStatus || updateError) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ 
              background: updateError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(77, 217, 172, 0.1)',
              borderBottom: `1px solid ${updateError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(77, 217, 172, 0.2)'}`,
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1400, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  background: updateError ? 'var(--status-red)' : 'var(--accent)', 
                  padding: 4, 
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={14} color="#000" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: updateError ? 'var(--status-red)' : 'var(--text-primary)' }}>
                  {updateError ? `Update failed: ${updateError}` : 
                   updateStatus === 'available' ? 'A new software patch is available with fixes and performance improvements.' :
                   updateStatus === 'downloaded' ? 'Update downloaded and ready to install. Restart to apply changes.' :
                   `Downloading patch... ${Math.round(updateProgress)}%`}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {updateStatus === 'available' && !updateError && (
                  <button 
                    onClick={() => {
                      setUpdateStatus('downloading');
                      window.electronAPI.downloadUpdate();
                    }}
                    style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Download Patch
                  </button>
                )}
                {updateStatus === 'downloaded' && (
                  <button 
                    onClick={() => window.electronAPI.installUpdate()}
                    style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Restart & Update
                  </button>
                )}
                <button 
                  onClick={() => { setUpdateStatus(null); setUpdateError(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ background:'rgba(12, 14, 18, 0.8)', backdropFilter: 'blur(12px)', borderBottom:'1px solid var(--border-subtle)', height:64, display:'flex', alignItems:'center', padding:'0 24px', position:'sticky', top:0, zIndex:200, flexShrink:0 }}>
        <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:32 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <Logo size={36} />
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:600, letterSpacing:'0.1em', color:'var(--accent)', textTransform:'uppercase', lineHeight:1.2 }}>
                  AXIOMETRIC
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily:"var(--font-sans)", fontSize:10, color:'var(--text-muted)', lineHeight:1 }}>
                    {activeModule === 'core' ? 'Core Session Manager' : 'Rubric Scoring Agent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Module Switcher Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 3, border: '1px solid var(--border-subtle)' }}>
              <button 
                onClick={() => setActiveModule('core')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  border: 'none',
                  background: activeModule === 'core' ? 'var(--accent-dim)' : 'transparent',
                  color: activeModule === 'core' ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Core Manager
              </button>
              <button 
                onClick={() => setActiveModule('agent')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  border: 'none',
                  background: activeModule === 'agent' ? 'rgba(91, 138, 240, 0.15)' : 'transparent',
                  color: activeModule === 'agent' ? 'var(--status-blue)' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Rubric Agent
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Top Bar AI Assistant Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsChatOpen(!isChatOpen)}
              style={{
                background: 'rgba(77, 217, 172, 0.08)',
                border: '1px solid rgba(77, 217, 172, 0.2)',
                borderRadius: '20px',
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ position: 'relative' }}>
                <Sparkles size={16} color="var(--accent)" />
                <motion.div 
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ position: 'absolute', inset: -2, background: 'var(--accent)', borderRadius: '50%', zIndex: -1 }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-accent)' }}>
                Ask Axiometric AI
              </span>
            </motion.button>

            <div style={{ display:'flex', alignItems:'center', gap:20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:'var(--text-muted)' }}>
                  {formatDate(todayStr())}
                </span>
                <span className={timerState?.running ? 'timer-running' : ''}
                  style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:600, minWidth:80, textAlign:'right',
                  color: timerState?.running ? 'var(--accent)' : (timerElapsed > 0 ? 'var(--status-amber)' : 'var(--text-muted)') }}>
                  {fmtHHMMSS(timerElapsed)}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--border-subtle)', paddingLeft: 20 }}>
                <button 
                  onClick={() => setActiveTab('settings')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
                <button 
                  onClick={() => signOut(auth)}
                  className="btn-secondary"
                  style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4 }}
                >
                  LOGOUT
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'hidden', display: 'flex' }}>
        {activeModule === 'core' ? (
          <>
            <div style={{ width:220, flexShrink:0, background:'rgba(12, 14, 18, 0.4)', borderRight:'1px solid var(--border-subtle)', position:'sticky', top:0, height:'100%', overflowY:'auto', zIndex:100, display:'flex', flexDirection:'column', paddingTop:20 }}>
              {NAV_GROUPS.map(group => (
                <div key={group.label} style={{ marginBottom:24 }}>
                  <div style={{ padding:'0 24px 8px', fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:'0.16em', color:'var(--text-muted)', textTransform:'uppercase', opacity: 0.6 }}>
                    {group.label}
                  </div>
                  {group.tabs.map(tab => {
                    if (tab.id === 'team-sharing' && !isAdmin) return null;
                    
                    return (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`nav-item${activeTab===tab.id ? ' nav-active' : ''}`}
                        style={{
                          display:'block', width:'100%', textAlign:'left',
                          background: activeTab===tab.id ? 'rgba(77,217,172,0.06)' : 'transparent',
                          border:'none',
                          borderLeft: activeTab===tab.id ? '3px solid var(--accent)' : '3px solid transparent',
                          color: activeTab===tab.id ? 'var(--accent)' : 'var(--text-muted)',
                          padding:'10px 24px',
                          fontFamily:"var(--font-mono)",
                          fontSize:12, letterSpacing:'0.04em',
                          cursor:'pointer',
                        }}>
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              
              <div style={{ marginTop: 'auto', padding: '32px 24px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.3 }}>
                  <Logo size={24} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', fontWeight: 600 }}>AXIOMETRIC</span>
                    <span style={{ fontSize: 9 }}>v3.0.1-integrated</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex:1, overflowY:'auto' }}>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ padding: '32px' }}
                >
                  {activeTab === 'dashboard' && <DashboardTab onNavigate={setActiveTab} />}
                  {activeTab === 'session-start' && <SessionStartTab />}
                  {activeTab === 'competency-tracker' && <CompetencyTracker />}
                  {activeTab === 'session-close' && <SessionCloseTab />}
                  {activeTab === 'document-store' && <DocumentStore />}
                  {activeTab === 'daily-summary' && <DailyWorkSummary />}
                  {activeTab === 'hours-pay' && <HoursPayTracker />}
                  {activeTab === 'jake-queue' && <BossQueueReviewAndPerplexity />}
                  {activeTab === 'masterplan' && <MasterplanTab />}
                  {activeTab === 'team-sharing' && <TeamSharingTab />}
                  {activeTab === 'settings' && <SettingsTab />}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, position: 'relative' }}>
            <RubricAgentModule />
          </div>
        )}
      </div>

        {/* Floating Chat Widget */}
        <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}>
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                style={{ marginBottom: 16 }}
              >
                <ChatWidget onClose={() => setIsChatOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 12px 40px rgba(77,217,172,0.4)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="btn-primary"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              boxShadow: '0 8px 32px rgba(77,217,172,0.3)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
          </motion.button>
    </div>
    </div>
  );
}

export default function App() {
  return (
    <CatalogProvider>
      <AppContent />
    </CatalogProvider>
  );
}
