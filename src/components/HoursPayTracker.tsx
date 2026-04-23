import React, { useState } from 'react';
import { useFirestore, useFirestoreDoc } from '../hooks/useFirestore';
import { usePermissions } from '../hooks/usePermissions';
import { db, auth } from '../firebase';
import { todayStr, formatDate } from '../utils';
import { Session, TeamMember } from '../types';
import { Users, Briefcase, DollarSign, Clock, ChevronRight, Edit2, Trash2, Mail, Info, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function SectionCard({ title, children, style }: { title?: string, children: React.ReactNode, style?: React.CSSProperties }) {
  return (
    <div className="card" style={{ padding: '20px 24px', marginBottom: 16, ...style }}>
      {title && (
        <div style={{ borderLeft: '2px solid #4dd9ac', paddingLeft: 12, marginBottom: 16 }}>
          <h3 style={{ fontFamily:"var(--font-mono)", color: '#4dd9ac', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

export function HoursPayTracker() {
  const { role, team, isAdmin, isOwner, loading: permsLoading, canDo } = usePermissions();
  
  // Selection State: Start with self
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const currentUid = auth.currentUser?.uid;
  const effectiveUid = (isAdmin && selectedUid) ? selectedUid : currentUid;

  // Find selected member details
  const selectedMember = team?.members && selectedUid ? team.members[selectedUid] : null;
  const displayName = selectedUid === currentUid || !selectedUid ? 'Your Data' : `${selectedMember?.nickname || 'Unknown'} (${selectedMember?.email})`;

  // Hook overrides for Team View
  const { data: sessions, addItem, updateItem, deleteItem } = useFirestore<Session>('hours', { 
    overrideUid: effectiveUid 
  });
  const { data: paySettings, setDocData: setPaySettings } = useFirestoreDoc<{ hourlyRate: string }>('settings', 'pay', { hourlyRate: '' }, {
    overrideUid: effectiveUid
  });

  const [form, setForm] = useState({ date: todayStr(), label:'', startTime:'', endTime:'', notes:'' });
  const [editId, setEditId] = useState<string | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const onCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(p => ({...p, [id]: true}));
      setTimeout(() => setCopied(p => ({...p, [id]: false})), 2000);
    });
  };

  const calcHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins <= 0 ? 0 : mins / 60;
  };

  const fmtDuration = (h: number) => {
    if (!h) return '0m';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const saveSession = async () => {
    if (!form.label.trim() || !form.date) return;
    try {
      if (editId) {
        await updateItem(editId, form);
        setEditId(null);
      } else {
        await addItem(form);
      }
      setForm({ date: todayStr(), label:'', startTime:'', endTime:'', notes:'' });
    } catch (e) {
      console.error('Error saving session:', e);
    }
  };

  const startEdit = (sess: Session) => {
    setForm({ date: sess.date, label: sess.label, startTime: sess.startTime, endTime: sess.endTime, notes: sess.notes || '' });
    setEditId(sess.id!);
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await deleteItem(id);
    } catch (e) {
      console.error('Error deleting session:', e);
    }
  };

  const cancelEdit = () => { setEditId(null); setForm({ date: todayStr(), label:'', startTime:'', endTime:'', notes:'' }); };

  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(now.setDate(diff));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: mon.toISOString().slice(0,10), end: sun.toISOString().slice(0,10) };
  };

  if (permsLoading) return <div className="p-8 text-muted">Authenticating workspace access...</div>;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const { start: weekStart, end: weekEnd } = getWeekRange();

  const weekSessions = sessions.filter(s => s.date >= weekStart && s.date <= weekEnd);
  const monthSessions = sessions.filter(s => s.date && s.date.startsWith(thisMonth));

  const totalHours = (arr: Session[]) => arr.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime), 0);
  const rate = parseFloat(paySettings.hourlyRate) || 0;

  const teamMembers: TeamMember[] = (team && team.members) ? Object.values(team.members) as TeamMember[] : [];

  return (
    <div className="tab-animate" style={{ maxWidth: 1000, margin: '0 auto', padding: '12px 0' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Hours & Pay Tracker</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Detailed log of work sessions and earnings for the framework project.</p>
      </div>

      {/* Team Navigation Tabs (Admin/Owner only) */}
      {isAdmin && teamMembers.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Users size={14} color="var(--text-accent)" />
            <h3 style={{ fontFamily:"var(--font-mono)", fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Team View Management
            </h3>
          </div>
          <div className="team-tabs">
            <button 
              className={`team-tab-item ${(!selectedUid || selectedUid === currentUid) ? 'active' : ''}`}
              onClick={() => setSelectedUid(currentUid!)}
            >
              My Data
            </button>
            {teamMembers.filter(m => m.uid !== currentUid).map(m => (
              <button 
                key={m.uid} 
                className={`team-tab-item ${selectedUid === m.uid ? 'active' : ''}`}
                onClick={() => setSelectedUid(m.uid)}
              >
                <span>{m.nickname}</span>
                <span style={{ opacity: 0.4, fontSize: 9 }}>({m.email})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Context Banner */}
      {selectedUid && selectedUid !== currentUid && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            background: 'rgba(91, 138, 240, 0.08)', 
            border: '1px solid rgba(91, 138, 240, 0.2)', 
            borderRadius: 6, 
            padding: '12px 16px', 
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={16} color="var(--status-blue)" />
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              Viewing records for <strong style={{ color: 'var(--status-blue)' }}>{displayName}</strong>
            </div>
          </div>
          <div className="badge badge-blue">ADMIN ACCESS MODE</div>
        </motion.div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14 }}>
            {[
              { label:'Weekly Interval', arr: weekSessions, icon: <Clock size={16} /> },
              { label:'Current Month', arr: monthSessions, icon: <Briefcase size={16} /> },
              { label:'Lifetime Summary', arr: sessions, icon: <DollarSign size={16} /> },
            ].map(({ label, arr, icon }) => {
              const h = totalHours(arr);
              return (
                <div key={label} className="summary-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
                    <div style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{icon}</div>
                  </div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:700, marginBottom:4, color:'var(--text-primary)' }}>{fmtDuration(h)}</div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:'var(--accent)', fontWeight:500 }}>{(h*rate).toFixed(3)} KWD</div>
                </div>
              );
            })}
          </div>

          {/* Session History */}
          <SectionCard title={`${selectedUid === currentUid || !selectedUid ? 'Your' : 'Member'} Session History`}>
            {sessions.length === 0 ? (
              <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No work logs found for this context.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Date','Description','Duration','Earnings','Actions'].map(h=>(
                        <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontFamily:"var(--font-mono)", fontSize:10, color:'var(--text-muted)', fontWeight:500, textTransform:'uppercase', borderBottom:'1px solid var(--border-subtle)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.sort((a,b)=>b.date.localeCompare(a.date)).map((s) => {
                      const h = calcHours(s.startTime, s.endTime);
                      return (
                        <tr key={s.id} style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                          <td style={{ padding:'12px 14px', fontFamily:"var(--font-mono)", fontSize:12 }}>{formatDate(s.date)}</td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.label}</div>
                            {s.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.notes}</div>}
                          </td>
                          <td style={{ padding:'12px 14px', fontFamily:"var(--font-mono)", fontSize:12 }}>{fmtDuration(h)}</td>
                          <td style={{ padding:'12px 14px', fontFamily:"var(--font-mono)", fontSize:12, color:'var(--accent)' }}>{(h*rate).toFixed(3)}</td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', gap:8 }}>
                              <button onClick={()=>startEdit(s)} className="btn-secondary" style={{ padding: '4px 8px' }}><Edit2 size={12} /></button>
                              <button onClick={()=>handleDeleteSession(s.id!)} className="btn-danger" style={{ padding: '4px 8px' }}><Trash2 size={12}/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Action Panel (Right Side) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionCard title="Quick Settings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Hourly Rate (KWD)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={paySettings.hourlyRate} 
                  onChange={e => setPaySettings({ ...paySettings, hourlyRate: e.target.value })} 
                  placeholder="2.5" 
                />
              </div>
              <button className="btn-secondary" style={{ width: '100%', fontSize: 11 }} onClick={() => {
                const lines = sessionExport(monthSessions, rate, thisMonth);
                onCopy(lines, 'export');
              }}>
                {copied['export'] ? 'COPIED TO CLIPBOARD' : 'EXPORT MONTH (TEXT)'}
              </button>
            </div>
          </SectionCard>

          <SectionCard title={editId ? "Edit Entry" : "New Log Entry"}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
              <input value={form.label} onChange={e=>setForm(p=>({...p,label:e.target.value}))} placeholder="Work Description..." />
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="time" value={form.startTime} onChange={e=>setForm(p=>({...p,startTime:e.target.value}))} />
                <input type="time" value={form.endTime} onChange={e=>setForm(p=>({...p,endTime:e.target.value}))} />
              </div>
              <textarea 
                value={form.notes} 
                onChange={e=>setForm(p=>({...p,notes:e.target.value}))} 
                placeholder="Additional notes..." 
                style={{ fontSize: 11, minHeight: 60, padding: 10 }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={saveSession}>{editId ? 'UPDATE' : 'SAVE'}</button>
                {editId && <button className="btn-secondary" onClick={cancelEdit}>CANCEL</button>}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function sessionExport(sessions: Session[], rate: number, month: string) {
  const calcH = (s: string, e: string) => {
    if (!s || !e) return 0;
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  };
  const lines = [`AXIOMETRIC HOURS REPORT - ${month}`, `Rate: ${rate} KWD`, "-----------------"];
  sessions.forEach(s => {
    const h = calcH(s.startTime, s.endTime);
    lines.push(`${s.date}: ${s.label} (${h.toFixed(2)}h) - ${(h*rate).toFixed(3)} KWD`);
  });
  const total = sessions.reduce((sum, s) => sum + calcH(s.startTime, s.endTime), 0);
  lines.push("-----------------");
  lines.push(`TOTAL HOURS: ${total.toFixed(2)}h`);
  lines.push(`TOTAL PAY: ${(total*rate).toFixed(3)} KWD`);
  return lines.join('\n');
}
