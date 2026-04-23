import React, { useState } from 'react';
import { todayStr, formatDate } from '../utils';
import { Document } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useFirestore } from '../hooks/useFirestore';
import { auth } from '../firebase';
import { DOC_CATEGORIES, DOC_STATUSES } from '../constants';

function StatusBadge({ status }: { status: string }) {
  const badgeClass = (s: string) => {
    if (!s || s === "Not Started") return "badge badge-grey";
    if (s === "In Progress" || s === "Draft") return "badge badge-blue";
    if (s === "Pending Boss’s Queue Review") return "badge badge-amber";
    if (s === "Approved") return "badge badge-green";
    if (s === "Boss’s Queue Feedback  -  Revisions Needed" || s === "Superseded") return "badge badge-red";
    return "badge badge-grey";
  };
  return <span className={badgeClass(status)}>{status || "Not Started"}</span>;
}

export function DocumentStore() {
  const { team, role } = usePermissions();
  const { data: docs, addItem, updateItem, deleteItem } = useFirestore<any>('documents', { teamId: team?.id });
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name:'', category:'', version:'', url:'', status:'Draft', notes:'' });

  const resetForm = () => setForm({ name:'', category:'', version:'', url:'', status:'Draft', notes:'' });

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.notes||'').toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || d.category === filterCat;
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const saveDoc = async () => {
    if (!form.name.trim()) return;
    try {
      if (editId) {
        await updateItem(editId, form);
        setEditId(null);
      } else {
        const uploaderNickname = team?.members && auth.currentUser 
          ? team.members[auth.currentUser.uid]?.nickname 
          : 'Unknown';
        await addItem({ ...form, dateAdded: todayStr(), sharedBy: uploaderNickname });
      }
      resetForm();
      setShowAddForm(false);
    } catch (e) {
      console.error('Error saving document:', e);
    }
  };

  const startEdit = (doc: Document) => {
    setForm({ name: doc.name, category: doc.category, version: doc.version, url: doc.url, status: doc.status, notes: doc.notes || '' });
    setEditId(doc.id!);
    setShowAddForm(true);
    window.scrollTo(0, 0);
  };

  const handleDeleteDoc = async (id: string) => {
    // We'll use a custom modal or just proceed if the user confirmed in a real app
    // For now, let's assume confirmation is handled by the UI or just proceed
    try {
      await deleteItem(id);
    } catch (e) {
      console.error('Error deleting document:', e);
    }
  };

  const cancelForm = () => { resetForm(); setEditId(null); setShowAddForm(false); };

  const isPlaceholder = (url: string) => !url || url === 'placeholder' || url.trim() === '';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Document Store</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>All project documents for the Axiometric Framework.</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setEditId(null); setShowAddForm(s => !s); }}>
          {showAddForm && !editId ? 'x  Cancel' : '+ Add Document'}
        </button>
      </div>

      {showAddForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{editId ? 'Edit Document' : 'Add New Document'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Name *</label>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Document name" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Category</label>
              <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                <option value=""> -  Select  - </option>
                {DOC_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Version</label>
              <input value={form.version} onChange={e=>setForm(p=>({...p,version:e.target.value}))} placeholder="e.g. v1" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Status</label>
              <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                {DOC_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Google Doc URL</label>
              <input value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))} placeholder="https://docs.google.com/..." />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Notes</label>
              <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" />
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <button className="btn-primary" onClick={saveDoc}>{editId ? 'Save Changes' : 'Add Document'}</button>
            <button className="btn-secondary" onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents..." style={{ maxWidth:280 }} />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ maxWidth:200 }}>
          <option value="">All Categories</option>
          {DOC_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ maxWidth:200 }}>
          <option value="">All Statuses</option>
          {DOC_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:'var(--text-secondary)', display:'flex', alignItems:'center' }}>{filtered.length} document{filtered.length!==1?'s':''}</span>
      </div>

      <div style={{ border:'1px solid var(--border-subtle)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
            <thead>
              <tr style={{ background:'var(--bg-base)' }}>
                {['Name','Category','Ver.','URL','Status','Notes','By','Added','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:"var(--font-mono)", fontSize:10, color:'var(--text-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.12em', whiteSpace:'nowrap', borderBottom:'1px solid var(--border-default)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No documents found.</td></tr>
              ) : filtered.map((doc) => (
                <tr key={doc.id} style={{ borderBottom:'1px solid var(--border-subtle)' }}>
                  <td style={{ padding:'10px 14px', fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{doc.name}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{doc.category}</td>
                  <td style={{ padding:'10px 14px', fontFamily:"var(--font-mono)", fontSize:11, color:'var(--text-secondary)' }}>{doc.version}</td>
                  <td style={{ padding:'10px 14px' }} className="link-cell">
                    {isPlaceholder(doc.url)
                      ? <span className="placeholder-link">Link not yet added</span>
                      : <a href={doc.url} target="_blank" rel="noopener noreferrer" title={doc.url}>Open -&gt;</a>
                    }
                  </td>
                  <td style={{ padding:'10px 14px' }}><StatusBadge status={doc.status} /></td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-secondary)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={doc.notes}>{doc.notes || ' - '}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span className="attribution-badge">{doc.sharedBy || 'System'}</span>
                  </td>
                  <td style={{ padding:'10px 14px', fontFamily:"var(--font-mono)", fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(doc.dateAdded)}</td>
                  <td style={{ padding:'8px 14px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn-secondary" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>startEdit(doc)}>Edit</button>
                      <button className="btn-danger" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>handleDeleteDoc(doc.id!)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
