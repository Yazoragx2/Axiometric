import React, { useState, useEffect } from 'react';
import { useFirestoreDoc } from '../hooks/useFirestore';
import { formatDate, todayStr } from '../utils';

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

export function SessionCloseTab() {
  const [date, setDate] = useState(todayStr());
  const [deliverables, setDeliverables] = useState([{ name: '', description: '', link: '' }]);
  const [decisions, setDecisions] = useState(['']);
  const [openItems, setOpenItems] = useState(['']);
  const [primarySources, setPrimarySources] = useState('');
  const [dataOrg, setDataOrg] = useState('');
  const [updateLog, setUpdateLog] = useState('');
  const [workReport, setWorkReport] = useState('');
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const onCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(p => ({...p, [id]: true}));
      setTimeout(() => setCopied(p => ({...p, [id]: false})), 2000);
    });
  };

  const { data: timerState } = useFirestoreDoc<any>('timer', 'current', { running: false, startTimestamp: null, label: '', elapsedAtStop: 0 });
  const [ctxDismissed, setCtxDismissed] = useState(false);

  const loadContext = () => {
    if (!timerState?.label) return;
    setDate(todayStr());
    setDataOrg(`Axiometric Framework folder  -  ${timerState.label} session`);
    setCtxDismissed(true);
  };

  const addDeliverable = () => { if (deliverables.length < 5) setDeliverables(p => [...p, { name:'', description:'', link:'' }]); };
  const removeDeliverable = (i: number) => setDeliverables(p => p.filter((_,idx)=>idx!==i));
  const updateDeliverable = (i: number, field: string, val: string) => setDeliverables(p => p.map((d,idx)=>idx===i?{...d,[field]:val}:d));

  const addDecision = () => { if (decisions.length < 10) setDecisions(p => [...p, '']); };
  const removeDecision = (i: number) => setDecisions(p => p.filter((_,idx)=>idx!==i));
  const updateDecision = (i: number, val: string) => setDecisions(p => p.map((d,idx)=>idx===i?val:d));

  const addOpen = () => { if (openItems.length < 10) setOpenItems(p => [...p, '']); };
  const removeOpen = (i: number) => setOpenItems(p => p.filter((_,idx)=>idx!==i));
  const updateOpen = (i: number, val: string) => setOpenItems(p => p.map((d,idx)=>idx===i?val:d));

  const generateUpdateLog = () => {
    const d = formatDate(date);
    const delivNames = deliverables.filter(d=>d.name.trim()).map(d=>d.name.trim());
    const objective = delivNames.length ? delivNames.join(', ') : 'As specified in session brief';

    let whatBuilt = '';
    deliverables.filter(d=>d.name.trim()).forEach(d => {
      whatBuilt += `\n${d.name.trim()}\n${d.description.trim() || ' -  No description provided.'}\n`;
    });

    const decisionsText = decisions.filter(d=>d.trim()).map(d=>`*  ${d.trim()}`).join('\n') || '*  None recorded.';
    const openText = openItems.filter(d=>d.trim()).map(d=>`*  ${d.trim()}`).join('\n') || '*  None recorded.';

    let docsProduced = '';
    deliverables.filter(d=>d.name.trim()).forEach(d => {
      docsProduced += `\n*  ${d.name.trim()}${d.link.trim() ? '  -  ' + d.link.trim() : ''}`;
    });

    const log = `UPDATE LOG  -  ${d}
Jakes Professionals  -  Axiometric Framework  -  Phase 2

SESSION OVERVIEW
Date: ${d}
Phase: Phase 2  -  Competency Build
Lead: Felixvenue
Objective: ${objective}
STATUS: COMPLETE

WHAT WAS BUILT${whatBuilt || '\n -  No deliverables recorded.'}

KEY DECISIONS MADE
${decisionsText}

WHAT REMAINS OPEN
${openText}

DOCS PRODUCED${docsProduced || '\n*  None recorded.'}

Felixvenue | Jakes Professionals | ${d}`;
    setUpdateLog(log);
  };

  const generateWorkReport = () => {
    const d = formatDate(date);
    const validDelivs = deliverables.filter(d=>d.name.trim());
    const validOpen = openItems.filter(d=>d.trim());

    let summary = '';
    if (validDelivs.length === 0) {
      summary = 'No deliverables were recorded for this session.';
    } else if (validDelivs.length === 1) {
      summary = `Today's session focused on completing ${validDelivs[0].name.trim()}. ${validDelivs[0].description.trim() ? validDelivs[0].description.trim() : ''} All work has been documented and is ready for the next stage of review.`;
    } else {
      const names = validDelivs.map(d=>d.name.trim());
      const last = names.pop();
      summary = `Today's session produced the following deliverables: ${names.join(', ')}, and ${last}. Work covered development, drafting, and quality review of each item in accordance with Phase 2 protocols. All outputs have been documented and submitted or staged for Boss’s Queue review.`;
    }

    const nextAgenda = validOpen.length
      ? validOpen.map(i=>`*  ${i.trim()}`).join('\n')
      : '*  Review session outputs and plan next steps.';

    const report = `WORK COMPLETION REPORT  -  ${d}
Jakes Professionals  -  Axiometric Framework

-----------------------------------
BRIEF SUMMARY OF WORK DONE TODAY
-----------------------------------
${summary}

-----------------------------------
DATA ORGANISATION
-----------------------------------
${dataOrg.trim() || ' -  Not specified.'}

-----------------------------------
PRIMARY SOURCES USED
-----------------------------------
${primarySources.trim() || ' -  Not specified.'}

-----------------------------------
NEXT DAY'S AGENDA
-----------------------------------
${nextAgenda}

Felixvenue | Jakes Professionals | ${d}`;
    setWorkReport(report);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 32px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Session Close</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>Document what was completed and generate your update log and work completion report.</p>

      {timerState?.label && !ctxDismissed && (
        <div style={{ background: 'rgba(91,138,240,0.10)', border: '1px solid var(--status-blue)', borderRadius: 4, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--status-blue)', marginBottom: 4 }}>Session context available from active timer.</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{timerState.label}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={loadContext}>Load context</button>
              <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setCtxDismissed(true)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <SectionCard>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Session Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ maxWidth: 200 }} />
      </SectionCard>

      <SectionCard title="A  -  Deliverables">
        {deliverables.map((d, i) => (
          <div key={i} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deliverable {i+1}</span>
              {deliverables.length > 1 && (
                <button className="btn-danger" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => removeDeliverable(i)}>Remove</button>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <input value={d.name} onChange={e=>updateDeliverable(i,'name',e.target.value)} placeholder="Deliverable name (e.g. SemanticClarity_Competency_v1)" />
              <input value={d.description} onChange={e=>updateDeliverable(i,'description',e.target.value)} placeholder="Brief description of what was produced" />
              <input value={d.link} onChange={e=>updateDeliverable(i,'link',e.target.value)} placeholder="Google Doc URL (optional)" />
            </div>
          </div>
        ))}
        {deliverables.length < 5 && (
          <button className="btn-secondary" onClick={addDeliverable} style={{ fontSize: 13 }}>+ Add Deliverable</button>
        )}
      </SectionCard>

      <SectionCard title="B  -  Key Decisions Made">
        {decisions.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={d} onChange={e=>updateDecision(i,e.target.value)} placeholder={`Decision ${i+1}...`} />
            {decisions.length > 1 && (
              <button className="btn-danger" style={{ fontSize: 12, padding: '5px 10px', whiteSpace:'nowrap' }} onClick={() => removeDecision(i)}>x </button>
            )}
          </div>
        ))}
        {decisions.length < 10 && (
          <button className="btn-secondary" onClick={addDecision} style={{ fontSize: 13 }}>+ Add Decision</button>
        )}
      </SectionCard>

      <SectionCard title="C  -  What Remains Open">
        {openItems.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={d} onChange={e=>updateOpen(i,e.target.value)} placeholder={`Open item ${i+1}...`} />
            {openItems.length > 1 && (
              <button className="btn-danger" style={{ fontSize: 12, padding: '5px 10px', whiteSpace:'nowrap' }} onClick={() => removeOpen(i)}>x </button>
            )}
          </div>
        ))}
        {openItems.length < 10 && (
          <button className="btn-secondary" onClick={addOpen} style={{ fontSize: 13 }}>+ Add Item</button>
        )}
      </SectionCard>

      <SectionCard title="D  -  Primary Sources Used">
        <textarea value={primarySources} onChange={e=>setPrimarySources(e.target.value)} rows={3} placeholder="List primary sources, references, or research materials used this session..." />
      </SectionCard>

      <SectionCard title="E  -  Data Organisation">
        <textarea value={dataOrg} onChange={e=>setDataOrg(e.target.value)} rows={3} placeholder="Describe how documents and data were organised, filed, or structured this session..." />
      </SectionCard>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn-primary" onClick={generateUpdateLog}>Generate Update Log</button>
        <button className="btn-success" onClick={generateWorkReport}>Generate Work Completion Report</button>
      </div>

      {updateLog && (
        <SectionCard title="Update Log Output">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <CopyButton text={updateLog} id="updatelog" copied={copied} onCopy={onCopy} />
          </div>
          <textarea value={updateLog} readOnly rows={20} className="output-area" />
        </SectionCard>
      )}

      {workReport && (
        <SectionCard title="Work Completion Report (Discord)">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <CopyButton text={workReport} id="workreport" copied={copied} onCopy={onCopy} />
          </div>
          <textarea value={workReport} readOnly rows={20} className="output-area" />
        </SectionCard>
      )}
    </div>
  );
}
