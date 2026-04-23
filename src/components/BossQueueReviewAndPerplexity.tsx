import React, { useState } from 'react';
import { useCatalog } from '../CatalogContext';
import { useFirestore } from '../hooks/useFirestore';
import { PRIORITY_OPTIONS, QUEUE_STATUSES, ADJACENT_MAP } from '../constants';
import { todayStr, formatDate } from '../utils';
import { QueueItem } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { auth } from '../firebase';
import { Shield, Sparkles, MessageSquare, Plus } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const badgeClass = (s: string) => {
    if (s === "Waiting") return "badge badge-amber";
    if (s === "Boss’s Queue Responded") return "badge badge-blue";
    if (s === "Complete") return "badge badge-green";
    if (s === "On Hold") return "badge badge-grey";
    return "badge badge-grey";
  };
  return <span className={badgeClass(status)}>{status}</span>;
}

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

function CopyButton({ text, id, copied, onCopy }: { text: string, id: string, copied: Record<string, boolean>, onCopy: (t: string, id: string) => void }) {
  const isCopied = copied[id];
  return (
    <button
      onClick={() => onCopy(text, id)}
      className="btn-secondary"
      style={{
        fontSize: 11,
        padding: '4px 10px',
        minWidth: 72,
        fontFamily: "var(--font-mono)",
        color: isCopied ? '#22d48a' : undefined,
        borderColor: isCopied ? '#22d48a' : undefined,
      }}
    >
      {isCopied ? '[COPIED]' : '[COPY]'}
    </button>
  );
}

export function BossQueueReviewAndPerplexity() {
  const { domains, allCompetencies, domainForComp } = useCatalog();
  const { team, isAdmin } = usePermissions();
  const { data: queue, addItem, updateItem, deleteItem } = useFirestore<any>('queue', { teamId: team?.id });
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editQId, setEditQId] = useState<string | null>(null);
  const [qForm, setQForm] = useState({ docName:'', action:'', priority:'High', status:'Waiting', dateSubmitted: todayStr(), notes:'', feedbackNotes:'' });
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const onCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(p => ({...p, [id]: true}));
      setTimeout(() => setCopied(p => ({...p, [id]: false})), 2000);
    });
  };

  const [pxComp, setPxComp] = useState('');
  const [pxDef, setPxDef] = useState('');
  const [pxAdjacent, setPxAdjacent] = useState('');
  const [pxOutput, setPxOutput] = useState('');

  const sortedQueue = [...queue].sort((a,b) => {
    const pOrder: Record<string, number> = { High:0, Medium:1, Low:2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    return (a.dateSubmitted||'').localeCompare(b.dateSubmitted||'');
  });

  const visibleQueue = showCompleted ? sortedQueue : sortedQueue.filter(q=>q.status !== 'Complete');

  const saveQItem = async () => {
    if (!qForm.docName.trim()) return;
    try {
      if (editQId) {
        await updateItem(editQId, qForm);
        setEditQId(null);
      } else {
        const creatorNickname = team?.members && auth.currentUser 
          ? team.members[auth.currentUser.uid]?.nickname 
          : 'Unknown';
        await addItem({ ...qForm, sharedBy: creatorNickname });
      }
      setQForm({ docName:'', action:'', priority:'High', status:'Waiting', dateSubmitted: todayStr(), notes:'', feedbackNotes:'' });
      setShowAddForm(false);
    } catch (e) {
      console.error('Error saving queue item:', e);
    }
  };

  const startEditQ = (item: QueueItem) => {
    setQForm({ docName: item.docName, action: item.action||'', priority: item.priority, status: item.status, dateSubmitted: item.dateSubmitted, notes: item.notes||'', feedbackNotes: item.feedbackNotes||'' });
    setEditQId(item.id!);
    setShowAddForm(true);
  };

  const handleDeleteQItem = async (id: string) => {
    try {
      await deleteItem(id);
    } catch (e) {
      console.error('Error deleting queue item:', e);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await updateItem(id, { status });
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

  const updateFeedbackNotes = async (id: string, val: string) => {
    try {
      await updateItem(id, { feedbackNotes: val });
    } catch (e) {
      console.error('Error updating feedback notes:', e);
    }
  };

  const handleCompSelect = (compName: string) => {
    setPxComp(compName);
    const comp = allCompetencies.find(c=>c.name===compName);
    if (comp) {
      setPxAdjacent(ADJACENT_MAP[comp.id] || '');
    }
    setPxDef('');
    setPxOutput('');
  };

  const generatePrompt = () => {
    if (!pxComp) return;
    const def = pxDef.trim() || '[INSERT DEFINITION FROM OBJECTIVE CRITERIA]';
    const adj = pxAdjacent.trim() || '[ADJACENT COMPETENCIES]';
    const prompt = `I am building a behavioural competency rubric for professional Virtual Assistants on the competency of ${pxComp}  -  defined as ${def}. This competency is distinct from ${adj}.

I need research on the following specifically:

1. Failure modes  -  What are the distinct, independently observable ways a message, piece of reasoning, or output fails at ${pxComp}? I need failure modes that are genuinely separate from each other, not overlapping descriptions of the same problem. What are the 4 - 6 core ways this competency breaks down?

2. Dimensions  -  Is there existing research or frameworks that decompose ${pxComp} into distinct components that can be independently assessed? I am looking for a breakdown into 3 - 5 dimensions that together constitute the full expression of this competency.

3. Developmental progression  -  What does early-stage (poor) ${pxComp} look like versus competent versus expert? What is the structural or cognitive shift that separates someone who demonstrates ${pxComp} sometimes from someone who does it consistently?

4. Consequences  -  What specific, measurable problems does the absence of ${pxComp} cause in professional or organisational contexts? I need concrete examples, not general statements.

5. Boundary with adjacent competencies  -  How is ${pxComp} distinct from ${adj}? Where do these competencies overlap, and what is the precise line between them?

Sources: prioritise communication theory, linguistics, cognitive psychology, professional writing research, organisational communication, and relevant domain literature. Cite sources.`;
    setPxOutput(prompt);
  };

  const waitingCount = queue.filter(q=>q.status==='Waiting').length;

  const showFeedbackField = (item: QueueItem) => {
    return item.status === 'Boss’s Queue Responded' || item.status === 'Complete' || (item.feedbackNotes && item.feedbackNotes.trim().length > 0);
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Boss’s Queue Review & Perplexity Prompt Generator</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>Track items awaiting Boss’s Queue review and generate targeted Perplexity research prompts.</p>

      <div style={{ marginBottom: 32 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12 }}>
              <h3 style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-accent)' }}>Section A  -  Boss’s Queue Review Queue</h3>
            </div>
            {waitingCount > 0 && (
              <span style={{ fontFamily:"var(--font-mono)", background:'rgba(240,160,75,0.15)', color:'var(--status-amber)', borderRadius:2, padding:'2px 8px', fontSize:10, fontWeight:500, letterSpacing:'0.08em' }}>{waitingCount} waiting</span>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-secondary" style={{ fontSize:12 }} onClick={() => setShowCompleted(s=>!s)}>
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
            <button className="btn-primary" style={{ fontSize:13 }} onClick={() => { setQForm({ docName:'', action:'', priority:'High', status:'Waiting', dateSubmitted: todayStr(), notes:'', feedbackNotes:'' }); setEditQId(null); setShowAddForm(s=>!s); }}>
              + Add Item
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="card" style={{ padding:18, marginBottom:16 }}>
            <h4 style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>{editQId ? 'Edit Queue Item' : 'Add Queue Item'}</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Document Name *</label>
                <input value={qForm.docName} onChange={e=>setQForm(p=>({...p,docName:e.target.value}))} placeholder="e.g. SemanticClarity_Competency_v1" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Action Needed</label>
                <input value={qForm.action} onChange={e=>setQForm(p=>({...p,action:e.target.value}))} placeholder="e.g. Review & Approve" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Date Submitted</label>
                <input type="date" value={qForm.dateSubmitted} onChange={e=>setQForm(p=>({...p,dateSubmitted:e.target.value}))} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Priority</label>
                <select value={qForm.priority} onChange={e=>setQForm(p=>({...p,priority:e.target.value}))}>
                  {PRIORITY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Status</label>
                <select value={qForm.status} onChange={e=>setQForm(p=>({...p,status:e.target.value}))}>
                  {QUEUE_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Notes</label>
                <input value={qForm.notes} onChange={e=>setQForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Boss’s Queue's Feedback Notes</label>
                <textarea value={qForm.feedbackNotes} onChange={e=>setQForm(p=>({...p,feedbackNotes:e.target.value}))} rows={2} placeholder="Record Boss’s Queue's feedback or response here..." />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
              <button className="btn-primary" onClick={saveQItem}>{editQId ? 'Save Changes' : 'Add to Queue'}</button>
              <button className="btn-secondary" onClick={()=>{setShowAddForm(false);setEditQId(null);}}>Cancel</button>
            </div>
          </div>
        )}

        {visibleQueue.length === 0 ? (
          <div className="card" style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            {showCompleted ? 'Queue is empty.' : 'No waiting items. All clear!'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {visibleQueue.map(item => (
              <div key={item.id} className={`card ${item.status === 'Complete' ? 'opacity-55 border-l-2 border-status-green' : item.status === 'Waiting' ? 'border-l-2 border-status-amber' : ''}`} style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                      <span style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{item.docName}</span>
                      <StatusBadge status={item.status} />
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:10, padding:'2px 6px', borderRadius:2, background: item.priority==='High' ? 'rgba(224,92,106,0.12)' : item.priority==='Medium' ? 'rgba(240,160,75,0.12)' : 'rgba(91,138,240,0.12)', color: item.priority==='High' ? 'var(--status-red)' : item.priority==='Medium' ? 'var(--status-amber)' : 'var(--status-blue)' }}>
                        {item.priority}
                      </span>
                      <span className="attribution-badge">{item.sharedBy || 'System'}</span>
                    </div>
                    <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-secondary)', flexWrap:'wrap' }}>
                      {item.action && <span>Action: {item.action}</span>}
                      {item.dateSubmitted && <span>Submitted: {formatDate(item.dateSubmitted)}</span>}
                      {item.notes && <span>Notes: {item.notes}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
                    {item.status !== 'Complete' && (
                      <button className="btn-success" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>setStatus(item.id!,'Complete')}>[ok]  Done</button>
                    )}
                    {item.status === 'Waiting' && (
                      <button className="btn-secondary" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>setStatus(item.id!,'In Progress')}>-&gt; In Progress</button>
                    )}
                    {item.status === 'In Progress' && (
                      <button className="btn-secondary" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>setStatus(item.id!,'Boss’s Queue Responded')}>Boss’s Queue Responded</button>
                    )}
                    <button className="btn-secondary" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>startEditQ(item)}>Edit</button>
                    <button className="btn-danger" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>handleDeleteQItem(item.id!)}>Del</button>
                  </div>
                </div>
                {showFeedbackField(item) && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <label style={{ display: 'block', fontFamily:"var(--font-mono)", fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Boss’s Queue's Feedback:</label>
                    <textarea
                      rows={2}
                      value={item.feedbackNotes || ''}
                      onChange={e => updateFeedbackNotes(item.id!, e.target.value)}
                      placeholder="Record Boss’s Queue's feedback or response here..."
                      style={{ fontSize: 13, resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12, marginBottom: 14 }}>
          <h3 style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-accent)' }}>Section B  -  Perplexity Prompt Generator</h3>
        </div>
        <SectionCard>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>Competency</label>
              <select value={pxComp} onChange={e=>handleCompSelect(e.target.value)}>
                <option value=""> -  Select competency  - </option>
                {domains.map(d => (
                  <optgroup key={d.name} label={d.name}>
                    {d.competencies.map(c => (
                      <option key={c.id} value={c.name}>{c.id}. {c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>Domain (auto-filled)</label>
              <input value={pxComp ? (domainForComp[allCompetencies.find(c=>c.name===pxComp)?.id || 0] || '') : ''} readOnly style={{ background:'var(--bg-base)', color:'var(--text-muted)' }} placeholder="Select a competency above" />
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>Definition (from Objective Criteria)  -  editable</label>
            <textarea value={pxDef} onChange={e=>setPxDef(e.target.value)} rows={3} placeholder="Enter the competency definition as it appears in the objective criteria document..." />
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>Adjacent Competencies (auto-filled, editable)</label>
            <input value={pxAdjacent} onChange={e=>setPxAdjacent(e.target.value)} placeholder="Select a competency to auto-fill adjacent ones" />
          </div>

          <button className="btn-primary" onClick={generatePrompt} disabled={!pxComp} style={{ opacity: pxComp ? 1 : 0.4 }}>
            Generate Perplexity Prompt
          </button>
        </SectionCard>

        {pxOutput && (
          <SectionCard title="Generated Prompt">
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
              <CopyButton text={pxOutput} id="pxprompt" copied={copied} onCopy={onCopy} />
            </div>
            <textarea value={pxOutput} readOnly rows={18} className="output-area" />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
