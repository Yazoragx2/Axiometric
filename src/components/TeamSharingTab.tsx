import React, { useState } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  deleteField
} from 'firebase/firestore';
import { UserRole, TeamMember } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Shield, Mail, AlertCircle, Trash2 } from 'lucide-react';

export function TeamSharingTab() {
  const { role, team, isAdmin, isOwner, loading } = usePermissions();
  const [inviteForm, setInviteForm] = useState({ email: '', nickname: '', role: 'member' as UserRole });
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  if (loading) return <div className="p-8 text-muted">Synchronizing team data...</div>;

  if (!isAdmin) {
    return (
      <div className="tab-content" style={{ maxWidth: 860, textAlign: 'center', padding: '100px 40px' }}>
        <Shield size={64} color="var(--text-muted)" style={{ opacity: 0.2, marginBottom: 24 }} />
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Administrative Access Required</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          You are currently in <strong>Member Mode</strong>. Management of team members and workspace-wide role assignment is restricted to Owners and Administrators.
        </p>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setStatus(null);
    setIsInviting(true);

    try {
      // 1. Search for user identity by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', inviteForm.email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`The identity "${inviteForm.email}" was not found in our records. Please ensure they have established an account first.`);
      }

      const targetUser = querySnapshot.docs[0];
      const targetUid = targetUser.id;

      // 2. Already in team check
      if (team?.members && team.members[targetUid]) {
        throw new Error('This user is already a member of your team.');
      }

      // 3. Update User profile with teamId
      if (!team?.id) throw new Error('Active Team context not found.');
      
      await updateDoc(doc(db, 'users', targetUid), {
        teamId: team.id,
        role: inviteForm.role
      });

      // 4. Add to Team members map
      const newMember: TeamMember = {
        uid: targetUid,
        email: inviteForm.email,
        nickname: inviteForm.nickname || inviteForm.email.split('@')[0],
        role: inviteForm.role,
        joinedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'teams', team.id), {
        [`members.${targetUid}`]: newMember
      });

      setStatus({ type: 'success', msg: `Successfully connected ${inviteForm.nickname} to the team.` });
      setInviteForm({ email: '', nickname: '', role: 'member' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (targetUid: string) => {
    if (!isAdmin || !team?.id) return;
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await updateDoc(doc(db, 'teams', team.id), { [`members.${targetUid}`]: deleteField() });
      await updateDoc(doc(db, 'users', targetUid), { teamId: deleteField() });
      setStatus({ type: 'success', msg: 'Member removed successfully.' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    }
  };

  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
    if (!isAdmin || !team?.id) return;
    if (!window.confirm(`Change this member's role to ${newRole}?`)) return;
    try {
      await updateDoc(doc(db, 'teams', team.id), { [`members.${targetUid}.role`]: newRole });
      await updateDoc(doc(db, 'users', targetUid), { role: newRole });
      setStatus({ type: 'success', msg: 'Role updated.' });
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    }
  };

  const members: TeamMember[] = team?.members ? Object.values(team.members) as TeamMember[] : [];

  return (
    <div className="tab-content" style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', color: 'var(--text-accent)', textTransform: 'uppercase', marginBottom: 4 }}>
          Project Collaboration
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={20} color="var(--text-primary)" />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Team Sharing & Roles
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
          Manage your group, assign nicknames for data attribution, and control feature access.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 320px' : '1fr', gap: 24 }}>
        {/* Members List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Team Roster
            </h3>
            <span className="badge badge-accent">{members.length} MEMBERS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {members.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No colleagues connected yet. Use the invite form to start.
              </div>
            ) : (
              members.map((m) => (
                <div key={m.uid} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>{m.nickname[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{m.nickname}</span>
                      {isAdmin && m.role !== 'owner' ? (
                        <select 
                          value={m.role} 
                          onChange={(e) => handleRoleChange(m.uid, e.target.value as UserRole)}
                          style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}
                        >
                          <option value="member">MEMBER</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      ) : (
                        <span className={`badge ${m.role === 'owner' ? 'badge-amber' : m.role === 'admin' ? 'badge-blue' : 'badge-grey'}`} style={{ textTransform: 'uppercase', fontSize: 9 }}>
                          {m.role}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Mail size={10} /> {m.email}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {isAdmin && m.role !== 'owner' && (
                      <button 
                        onClick={() => handleRemove(m.uid)} 
                        className="btn-danger" 
                        style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, height: 'auto', fontSize: 10 }}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Joined {new Date(m.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invite Form */}
        {isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 24, background: 'rgba(77, 217, 172, 0.03)', border: '1px solid rgba(77, 217, 172, 0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <UserPlus size={18} color="var(--accent)" />
                <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Connect Colleague</h3>
              </div>

              <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Colleague Email</label>
                  <input 
                    type="email" 
                    value={inviteForm.email} 
                    onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Nickname (for data attribution)</label>
                  <input 
                    type="text" 
                    value={inviteForm.nickname} 
                    onChange={e => setInviteForm(p => ({ ...p, nickname: e.target.value }))}
                    placeholder="e.g. Jake - Senior VA"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Initial Role</label>
                  <select 
                    value={inviteForm.role}
                    onChange={e => setInviteForm(p => ({ ...p, role: e.target.value as UserRole }))}
                  >
                    <option value="member">Member (Regular)</option>
                    <option value="admin">Admin (Can Manage Team)</option>
                  </select>
                </div>

                {status && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ 
                      padding: 12, 
                      borderRadius: 4, 
                      fontSize: 11,
                      background: status.type === 'success' ? 'rgba(34, 212, 138, 0.1)' : 'rgba(224, 92, 106, 0.1)',
                      border: `1px solid ${status.type === 'success' ? 'rgba(34, 212, 138, 0.2)' : 'rgba(224, 92, 106, 0.2)'}`,
                      color: status.type === 'success' ? 'var(--status-green)' : 'var(--status-red)',
                      display: 'flex',
                      gap: 8
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    {status.msg}
                  </motion.div>
                )}

                <button 
                  className="btn-primary" 
                  disabled={isInviting || !inviteForm.email || !inviteForm.nickname}
                  style={{ marginTop: 8, height: 42 }}
                >
                  {isInviting ? 'CONNECTING...' : 'ADD TO TEAM'}
                </button>
              </form>
            </div>

            <div className="card" style={{ padding: 20, borderStyle: 'dashed', opacity: 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Shield size={16} color="var(--text-muted)" />
                <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Role Information</h4>
              </div>
              <ul style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li><strong>Admin</strong> roles can view all team hours, edit rubric phases, and manage member roles.</li>
                <li><strong>Member</strong> roles are restricted to viewing their own pay and have view-only access to project phases.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
