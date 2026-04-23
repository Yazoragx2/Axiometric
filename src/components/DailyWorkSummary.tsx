import React, { useState } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import { formatDate, todayStr } from '../utils';
import { usePermissions } from '../hooks/usePermissions';
import { auth } from '../firebase';
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

function CopyButton({ text, id, copied, onCopy }: { text: string, id: string, copied: string | null, onCopy: (id: string, t: string) => void }) {
  return (
    <button
      onClick={() => onCopy(id, text)}
      style={{
        background: 'transparent',
        color: copied === id ? 'var(--status-green)' : 'var(--text-secondary)',
        border: '1px solid ' + (copied === id ? 'var(--status-green)' : 'var(--border-default)'),
        borderRadius: 3,
        padding: '4px 10px',
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        minWidth: 72,
        transition: 'all 0.12s'
      }}
    >
      {copied === id ? '[COPIED]' : '[COPY]'}
    </button>
  );
}

export function DailyWorkSummary() {
  const { team } = usePermissions();
  const { data: workItems, addItem, deleteItem, clearCollection } = useFirestore<any>('workItems', { teamId: team?.id });
  const [description, setDescription] = useState('');
  const [documents, setDocuments] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [category, setCategory] = useState('');
  const [briefs, setBriefs] = useState<any>(null);
  const [selectedBriefLength, setSelectedBriefLength] = useState('medium');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const addWorkItem = async () => {
    if (!description.trim()) {
      setError('Please enter a work description');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const item = {
      description,
      documents,
      timeSpent,
      category,
      timestamp: new Date().toLocaleTimeString(),
      date: todayStr()
    };
    try {
      const creatorNickname = team?.members && auth.currentUser 
        ? team.members[auth.currentUser.uid]?.nickname 
        : 'Unknown';
      await addItem({ ...item, sharedBy: creatorNickname });
      setDescription('');
      setDocuments('');
      setTimeSpent('');
      setCategory('');
    } catch (e) {
      console.error('Error adding work item:', e);
    }
  };

  const removeWorkItem = async (id: string) => {
    try {
      await deleteItem(id);
    } catch (e) {
      console.error('Error removing work item:', e);
    }
  };

  const generateBriefs = () => {
    if (workItems.length === 0) {
      setError('Please add at least one work item before generating a brief');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const totalTime = workItems.reduce((sum, item) => {
      const hours = parseFloat(item.timeSpent) || 0;
      return sum + hours;
    }, 0).toFixed(2);

    const allDocs = workItems
      .filter(item => item.documents && item.documents.trim())
      .map(item => item.documents)
      .filter((v, i, a) => a.indexOf(v) === i);

    const longBrief = `Daily Work Summary  -  ${formatDate(todayStr())}\n\n${workItems.map(item => `*  ${item.description}${item.documents ? ` (Docs: ${item.documents})` : ''}${item.timeSpent ? `  -  ${item.timeSpent}h` : ''}`).join('\n')}\n\nTotal Time: ${totalTime}h${allDocs.length > 0 ? `\n\nDocuments Worked On:\n${allDocs.map(d => `  *  ${d}`).join('\n')}` : ''}`;

    const achievements = workItems.map(item => item.description).join(', ');
    const mediumBrief = `Completed ${workItems.length} work item${workItems.length !== 1 ? 's' : ''} (${totalTime}h total): ${achievements}${allDocs.length > 0 ? `. Documents: ${allDocs.join(', ')}` : ''}.`;

    const shortBrief = `${workItems.length} task${workItems.length !== 1 ? 's' : ''} completed  -  ${totalTime}h${allDocs.length > 0 ? `  -  ${allDocs.slice(0, 2).join(', ')}${allDocs.length > 2 ? '...' : ''}` : ''}`;

    setBriefs({ long: longBrief, medium: mediumBrief, short: shortBrief });
  };

  const onCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClearAll = async () => {
    try {
      await clearCollection();
      setBriefs(null);
      setShowClearConfirm(false);
    } catch (e) {
      console.error('Error clearing work items:', e);
      setError('Failed to clear work items');
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Daily Work Summary</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Log your completed work and generate automated briefs in three lengths.</p>

      {error && (
        <div style={{ background: 'rgba(224,92,106,0.1)', border: '1px solid var(--status-red)', color: 'var(--status-red)', padding: '10px 14px', borderRadius: 4, marginBottom: 20, fontSize: 12 }}>
          {error}
        </div>
      )}

      <SectionCard title="Add Work Item">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Work Description *</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWorkItem()}
              placeholder="What did you complete? (e.g., Built Semantic Clarity competency doc)"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Time Spent (hours)</label>
            <input
              type="number"
              step="0.5"
              value={timeSpent}
              onChange={e => setTimeSpent(e.target.value)}
              placeholder="e.g., 3.5"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Documents/Files</label>
            <input
              value={documents}
              onChange={e => setDocuments(e.target.value)}
              placeholder="e.g., Semantic_Clarity_v1, Scoring_Template"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Select category</option>
              <option value="Competency Build">Competency Build</option>
              <option value="Admin/Documentation">Admin/Documentation</option>
              <option value="Research">Research</option>
              <option value="Boss’s Queue Feedback Actioning">Boss’s Queue Feedback Actioning</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <button className="btn-primary" onClick={addWorkItem} style={{ width: '100%' }}>
          + Add Work Item
        </button>
      </SectionCard>

      {workItems.length > 0 && (
        <SectionCard title={`Work Items (${workItems.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {workItems.map((item, idx) => (
              <div key={item.id} style={{ background: 'var(--bg-base)', padding: 12, borderRadius: 3, border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize: 12, fontWeight: 600, color: 'var(--text-accent)' }}>{idx + 1}.</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.description}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.timeSpent && <span>⏱ {item.timeSpent}h</span>}
                    {item.documents && <span>📄 {item.documents}</span>}
                    {item.category && <span className="badge badge-blue">{item.category}</span>}
                    <span className="attribution-badge">{item.sharedBy || 'System'}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeWorkItem(item.id!)}
                  className="btn-danger"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  x 
                </button>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={generateBriefs} style={{ width: '100%', marginTop: 16 }}>
            📝 Generate Briefs (All 3 Lengths)
          </button>
        </SectionCard>
      )}

      {briefs && (
        <SectionCard title="Generated Briefs">
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {['short', 'medium', 'long'].map(length => (
                <button
                  key={length}
                  onClick={() => setSelectedBriefLength(length)}
                  className={selectedBriefLength === length ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, textTransform: 'capitalize', fontWeight: selectedBriefLength === length ? 600 : 400 }}
                >
                  {length} Brief
                </button>
              ))}
            </div>

            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: 16, marginBottom: 12 }}>
              <textarea
                value={briefs[selectedBriefLength]}
                readOnly
                rows={selectedBriefLength === 'long' ? 12 : selectedBriefLength === 'medium' ? 6 : 3}
                className="output-area"
                style={{ fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CopyButton text={briefs[selectedBriefLength]} id={`brief-${selectedBriefLength}`} copied={copied} onCopy={onCopy} />
            </div>
          </div>

          {showClearConfirm ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-danger"
                onClick={handleClearAll}
                style={{ flex: 1 }}
              >
                Confirm Clear All?
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowClearConfirm(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => setShowClearConfirm(true)}
              style={{ width: '100%' }}
            >
              Clear All & Start New Day
            </button>
          )}
        </SectionCard>
      )}
    </div>
  );
}
