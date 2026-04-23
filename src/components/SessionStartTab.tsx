import React, { useState, useEffect } from 'react';
import { useFirestore, useFirestoreDoc } from '../hooks/useFirestore';
import { SESSION_TYPES } from '../constants';
import { formatDate, todayStr, fmtElapsed, fmtHHMM } from '../utils';
import { TimerState, Session } from '../types';

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

export function SessionStartTab() {
  const [sessionType, setSessionType] = useState("");
  const [compField, setCompField] = useState("");
  const [bossQueueDocField, setBossQueueDocField] = useState("");
  const [otherField, setOtherField] = useState("");
  const [objective, setObjective] = useState("");
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const onCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(p => ({...p, [id]: true}));
      setTimeout(() => setCopied(p => ({...p, [id]: false})), 2000);
    });
  };

  const { data: timerState, setDocData: saveTimer } = useFirestoreDoc<TimerState>('timer', 'current', { running: false, startTimestamp: null, label: '', elapsedAtStop: 0 });
  const { addItem: addSession } = useFirestore<Session>('hours');
  
  const [displayElapsed, setDisplayElapsed] = useState(0);
  const [logSuccess, setLogSuccess] = useState(false);

  useEffect(() => {
    const computeElapsed = () => {
      if (timerState.running && timerState.startTimestamp) {
        return Math.floor((Date.now() - timerState.startTimestamp) / 1000) + (timerState.elapsedAtStop || 0);
      }
      return timerState.elapsedAtStop || 0;
    };
    setDisplayElapsed(computeElapsed());

    if (!timerState.running) return;
    const id = setInterval(() => {
      setDisplayElapsed(computeElapsed());
    }, 1000);
    return () => clearInterval(id);
  }, [timerState]);

  const startTimer = () => {
    const newState = { running: true, startTimestamp: Date.now(), label: timerState.label || topic || 'Work Session', elapsedAtStop: timerState.elapsedAtStop || 0 };
    saveTimer(newState);
  };

  const stopTimer = () => {
    const elapsed = timerState.startTimestamp
      ? Math.floor((Date.now() - timerState.startTimestamp) / 1000) + (timerState.elapsedAtStop || 0)
      : (timerState.elapsedAtStop || 0);
    const newState = { running: false, startTimestamp: null, label: timerState.label, elapsedAtStop: elapsed };
    saveTimer(newState);
    setDisplayElapsed(elapsed);
  };

  const resetTimer = () => {
    const newState = { running: false, startTimestamp: null, label: '', elapsedAtStop: 0 };
    saveTimer(newState);
    setDisplayElapsed(0);
  };

  const logToHours = async () => {
    const elapsed = timerState.elapsedAtStop || displayElapsed;
    if (elapsed <= 0) return;
    const now = new Date();
    const endTime = fmtHHMM(now);
    const startDate = new Date(now.getTime() - elapsed * 1000);
    const startTime = fmtHHMM(startDate);
    const label = timerState.label || topic || 'Work Session';
    const dateStr = now.toISOString().slice(0, 10);

    try {
      await addSession({ date: dateStr, label, startTime, endTime, notes: '' });
      resetTimer();
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
    } catch(e) {
      console.error('Error logging session:', e);
    }
  };

  const generateBrief = () => {
    if (!sessionType || !objective.trim()) return;
    let topicStr = "";
    let briefStr = "";

    if (sessionType === "Competency Build") {
      const compText = compField.trim();
      if (!compText) {
        topicStr = "Axiometric Framework  -  Phase 2 Competency Build";
        briefStr = `Session Focus: Axiometric Framework  -  Phase 2 Competency Build\n\nThis session is part of the ongoing Axiometric Framework project at Jakes Professionals. Felixvenue will be conducting competency build work as part of the Phase 2 development cycle.\n\nObjective: ${objective.trim()}\n\nAll work will be documented and tracked according to established project protocols.`;
      } else {
        topicStr = `Axiometric Framework  -  Phase 2 Competency Build: ${compText}`;
        briefStr = `Session Focus: Axiometric Framework  -  Phase 2 Competency Build\n\nThis session is part of the ongoing Axiometric Framework project at Jakes Professionals. Felixvenue will be developing competency documentation for: ${compText}.\n\nObjective: ${objective.trim()}\n\nWork will include competency document drafting, scoring template development, and refinement in accordance with Phase 2 standards. All outputs will be logged and submitted for Boss’s Queue review upon completion.`;
      }
    } else if (sessionType === "Admin/Documentation") {
      topicStr = "Axiometric Framework  -  Administrative & Documentation";
      briefStr = `Session Focus: Axiometric Framework  -  Administrative & Documentation\n\nThis session is focused on administrative and documentation tasks within the Axiometric Framework project at Jakes Professionals, led by Felixvenue.\n\nObjective: ${objective.trim()}\n\nAll documentation will be maintained in the established project document store and update logs kept current.`;
    } else if (sessionType === "Research Only") {
      topicStr = "Axiometric Framework  -  Research";
      briefStr = `Session Focus: Axiometric Framework  -  Research\n\nThis is a dedicated research session within the Axiometric Framework project at Jakes Professionals, conducted by Felixvenue.\n\nObjective: ${objective.trim()}\n\nResearch findings will be documented, sources logged, and insights integrated into the relevant competency or phase materials.`;
    } else if (sessionType === "Boss’s Queue Feedback Actioning") {
      const docs = bossQueueDocField.trim() || "specified documents";
      topicStr = `Axiometric Framework  -  Boss’s Queue Feedback Actioning: ${docs}`;
      briefStr = `Session Focus: Axiometric Framework  -  Boss’s Queue Feedback Actioning\n\nThis session is dedicated to actioning feedback received from Boss’s Queue on the following document(s): ${docs}. This is part of the iterative review and refinement cycle within the Axiometric Framework project at Jakes Professionals, led by Felixvenue.\n\nObjective: ${objective.trim()}\n\nRevisions will be tracked against the original submission, documented with version increments, and resubmitted for Boss’s Queue review upon completion.`;
    } else if (sessionType === "Other") {
      const desc = otherField.trim() || "general project work";
      topicStr = `Axiometric Framework  -  ${desc}`;
      briefStr = `Session Focus: Axiometric Framework  -  ${desc}\n\nThis session covers the following work within the Axiometric Framework project at Jakes Professionals, led by Felixvenue: ${desc}.\n\nObjective: ${objective.trim()}\n\nAll work completed will be documented and logged in accordance with project tracking protocols.`;
    }

    setTopic(topicStr);
    setBrief(briefStr);

    if (!timerState.running) {
      saveTimer({ ...timerState, label: topicStr });
    }
  };

  const canGenerate = sessionType && objective.trim();

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 32px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Session Start</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>Set up your working session and generate a structured brief.</p>

      <SectionCard title="Session Configuration">
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Session Type</label>
          <select value={sessionType} onChange={e => { setSessionType(e.target.value); setCompField(""); }}>
            <option value=""> -  Select session type  - </option>
            {SESSION_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {sessionType === "Competency Build" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Which competency(s) are you working on?</label>
            <input value={compField} onChange={e => setCompField(e.target.value)} placeholder="e.g. Semantic Clarity, Conciseness" />
          </div>
        )}

        {sessionType === "Boss’s Queue Feedback Actioning" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Which document(s) is Boss’s Queue feedback on?</label>
            <input value={bossQueueDocField} onChange={e => setBossQueueDocField(e.target.value)} placeholder="e.g. DirectComm_Competency_v7, SemanticClarity_ScoringTemplate_v1" />
          </div>
        )}

        {sessionType === "Other" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Describe what you're working on</label>
            <input value={otherField} onChange={e => setOtherField(e.target.value)} placeholder="Brief description of the work" />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Objective  -  what will you accomplish today?</label>
          <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={3} placeholder="e.g. Complete v1 draft of Semantic Clarity competency document and scoring template, ready for Boss’s Queue review." />
        </div>

        <button className="btn-primary" onClick={generateBrief} disabled={!canGenerate} style={{ opacity: canGenerate ? 1 : 0.4 }}>
          Generate Brief
        </button>
      </SectionCard>

      <SectionCard title="Session Timer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: timerState.running ? 'var(--status-green)' : (displayElapsed > 0 ? 'var(--status-amber)' : 'var(--text-muted)'), minWidth: 120 }}>
            {fmtElapsed(displayElapsed)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Timer Label</div>
            <input
              value={timerState.label}
              onChange={e => {
                saveTimer({ ...timerState, label: e.target.value });
              }}
              placeholder={topic || 'Work Session'}
              style={{ fontSize: 13 }}
              disabled={timerState.running}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {!timerState.running && displayElapsed === 0 && (
            <button className="btn-success" onClick={startTimer}>&gt; Start Timer</button>
          )}
          {timerState.running && (
            <button className="btn-danger" onClick={stopTimer}>[stop] Stop Timer</button>
          )}
          {!timerState.running && displayElapsed > 0 && (
            <>
              <button className="btn-success" onClick={startTimer}>&gt; Resume</button>
              <button className="btn-primary" onClick={logToHours}>Log to Hours Tracker</button>
              <button className="btn-secondary" onClick={resetTimer}>Reset</button>
            </>
          )}
          {logSuccess && (
            <span style={{ fontFamily:"var(--font-mono)", color: 'var(--status-green)', fontSize: 12 }}>[ok]  Logged to Hours Tracker</span>
          )}
        </div>
      </SectionCard>

      {(topic || brief) && (
        <SectionCard title="Generated Brief">
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Topic Working On</label>
              <CopyButton text={topic} id="topic" copied={copied} onCopy={onCopy} />
            </div>
            <input value={topic} readOnly style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Objective & Brief Explanation</label>
              <CopyButton text={brief} id="brief" copied={copied} onCopy={onCopy} />
            </div>
            <textarea value={brief} readOnly rows={10} className="output-area" />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
