import React, { useState, useEffect, useRef } from 'react';
import { useCatalog } from '../CatalogContext';
import { useFirestore, useFirestoreDoc } from '../hooks/useFirestore';
import { AI_CHAT_HISTORY_KEY, TIMER_KEY } from '../constants';
import { todayStr, fmtElapsed } from '../utils';
import { Document, QueueItem, CompetencyStatus, TimerState } from '../types';
import { Logo } from './Logo';
import { Key, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
const CHAT_QUICK_PROMPTS = [
  'What phase are we in and what\'s the next step?',
  'How many competencies have I completed?',
  'What\'s waiting in the Boss’s Queue review queue?',
];

interface ChatWidgetProps {
  activeTab?: string;
  onClose?: () => void;
}

export function ChatWidget({ activeTab, onClose }: ChatWidgetProps) {
  const { domains, allCompetencies, totalCompetencies, setCustomCatalog } = useCatalog();
  
  // REPLACED: Transitioned from Firestore to LocalStorage for better stability and lower latency
  const [chatData, setChatDataState] = useState<{messages: any[]}>(() => {
    try {
      const saved = localStorage.getItem('axiometric_chat_history');
      return saved ? JSON.parse(saved) : { messages: [] };
    } catch (e) { return { messages: [] }; }
  });

  const [settings, setSettingsState] = useState<{model?: string}>(() => {
    try {
      const saved = localStorage.getItem('axiometric_settings');
      return saved ? JSON.parse(saved) : { model: 'qwen/qwen-plus' };
    } catch (e) { return { model: 'qwen/qwen-plus' }; }
  });

  const setChatData = (newData: any) => {
    setChatDataState(newData);
    localStorage.setItem('axiometric_chat_history', JSON.stringify(newData));
  };

  // Listen for storage changes (e.g., API key updated in the Settings tab)
  useEffect(() => {
    const handleStorage = () => {
      const savedSettings = localStorage.getItem('axiometric_settings');
      if (savedSettings) setSettingsState(JSON.parse(savedSettings));
      
      const savedChat = localStorage.getItem('axiometric_chat_history');
      if (savedChat) setChatDataState(JSON.parse(savedChat));
    };
    window.addEventListener('storage', handleStorage);
    // Custom event for same-tab updates
    window.addEventListener('axiometric_local_update', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('axiometric_local_update', handleStorage);
    };
  }, []);

  const messages = Array.isArray(chatData?.messages) ? chatData.messages : [];
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEnvelope, setPendingEnvelope] = useState<{env: any, rawText: string, nextMessages: any[]} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: docs, addItem: addItemDoc, updateItem: updateDoc, deleteItem: deleteDoc } = useFirestore<Document>('documents');
  const { data: queue, addItem: addQueue, updateItem: updateQueue, deleteItem: deleteQueue } = useFirestore<QueueItem>('queue');
  const { data: compList, addItem: addCompStatus, updateItem: updateCompStatus } = useFirestore<CompetencyStatus>('competencies');
  const { data: timerState, setDocData: setTimerState } = useFirestoreDoc<TimerState>('timer', 'current', { running: false, startTimestamp: null, label: '', elapsedAtStop: 0 });

  const compData = React.useMemo(() => {
    const map: Record<number, CompetencyStatus> = {};
    compList.forEach(c => { map[c.compId] = c; });
    return map;
  }, [compList]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  function buildContext() {
    try {
      const builtCount = allCompetencies.filter(c => compData[c.id] && compData[c.id].compDoc !== 'Not Started').length;
      const approvedCount = allCompetencies.filter(c => compData[c.id] && compData[c.id].compDoc === 'Approved').length;

      const domainBreakdown = domains.map(d => {
        const lines = d.competencies.map(c => {
          const s = compData[c.id] || { compDoc: 'Not Started', scoringTemplate: 'Not Started', notes: '' };
          const doc = s.compDoc;
          const tmpl = s.scoringTemplate;
          const notes = s.notes ? ` (${s.notes})` : '';
          return `  ${c.id}. ${c.name}: doc=${doc}, template=${tmpl}${notes}`;
        }).join('\n');
        const built = d.competencies.filter(c => compData[c.id] && compData[c.id].compDoc !== 'Not Started').length;
        const approved = d.competencies.filter(c => compData[c.id] && compData[c.id].compDoc === 'Approved').length;
        return `${d.name}  -  ${built}/${d.competencies.length} built, ${approved} approved:\n${lines}`;
      }).join('\n\n');

      const phase2Status = builtCount === totalCompetencies ? 'COMPLETE' : builtCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
      
      const activeQueue = queue.filter(q => q.status === 'Waiting' || q.status === 'In Progress');
      const queueLines = activeQueue.length
        ? activeQueue.map(q => `  - ${q.docName} [${q.status}] priority=${q.priority}`).join('\n')
        : '  None currently active';

      let timerInfo = 'Timer: not running';
      if (timerState.running && timerState.startTimestamp) {
        const elapsed = Math.floor((Date.now() - timerState.startTimestamp) / 1000) + (timerState.elapsedAtStop || 0);
        timerInfo = `Timer: RUNNING  -  ${fmtElapsed(elapsed)} elapsed`;
      } else if (timerState.elapsedAtStop > 0) {
        timerInfo = `Timer: paused  -  ${fmtElapsed(timerState.elapsedAtStop)} recorded`;
      }

      return `=== AXIOMETRIC FRAMEWORK  -  CURRENT STATE ===
Today: ${todayStr()} | Active tab: ${activeTab}
${timerInfo}

--- FRAMEWORK PHASES ---
Phase 1  -  Framework Design: COMPLETE
Phase 2  -  Competency Build: ${phase2Status} (${builtCount}/${totalCompetencies} built, ${approvedCount}/${totalCompetencies} approved by Boss’s Queue)

--- COMPETENCY STATUS (all ${totalCompetencies}) ---
${domainBreakdown}

--- BOSS’S QUEUE REVIEW QUEUE ---
Active items (${activeQueue.length}):
${queueLines}`;
    } catch(e) {
      return 'Context unavailable  -  Firestore read error.';
    }
  }

  function safeText(s: any, max = 180) {
    const t = (s || '').toString().trim();
    return t.length > max ? t.slice(0, max) : t;
  }

  function safeUrl(u: any) {
    const t = (u || '').toString().trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    return 'placeholder';
  }

  function nextDocId() {
    return 'doc' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  async function runActions(env: any) {
    let actions = Array.isArray(env?.actions) ? env.actions : [];
    const results: any[] = [];

    // Security: Cap actions per envelope to 5
    if (actions.length > 5) {
      actions = actions.slice(0, 5);
      results.push({ ok: false, action: 'system', error: 'Action count exceeded limit of 5. Extraneous actions ignored.' });
    }

    for (const a of actions) {
      const name = (a?.action || '').toString();
      const p = a?.params || {};
      
      // Security: Block destructive actions explicitly
      if (name === 'deleteDocument' || name === 'deleteQueueItem') {
        results.push({ ok: false, action: name, error: 'Deletions are not permitted via AI chat.' });
        continue;
      }

      try {
        let msg = '';
        if (name === 'addDocument') {
          const name = safeText(p?.name, 120);
          const category = safeText(p?.category, 60);
          if (!name || !category) throw new Error('addDocument requires name and category');
          const doc = { name, category, version: safeText(p?.version || '', 12), url: safeUrl(p?.url || ''), status: safeText(p?.status || 'Draft', 40), notes: safeText(p?.notes || '', 200), dateAdded: todayStr() };
          await addItemDoc(doc);
          msg = `Added document: ${name}`;
        } 
        else if (name === 'updateDocument') {
          const id = safeText(p?.id, 80);
          if (!id) throw new Error('updateDocument requires id');
          const updates: any = {};
          if (p.name !== undefined) updates.name = safeText(p.name, 120);
          if (p.category !== undefined) updates.category = safeText(p.category, 60);
          if (p.version !== undefined) updates.version = safeText(p.version, 12);
          if (p.url !== undefined) updates.url = safeUrl(p.url);
          if (p.status !== undefined) updates.status = safeText(p.status, 40);
          if (p.notes !== undefined) updates.notes = safeText(p.notes, 200);
          await updateDoc(id, updates);
          msg = `Updated document: ${id}`;
        }
        else if (name === 'deleteDocument') {
          const id = safeText(p?.id, 80);
          if (!id) throw new Error('deleteDocument requires id');
          await deleteDoc(id);
          msg = `Deleted document: ${id}`;
        }
        else if (name === 'addQueueItem') {
          const docName = safeText(p?.docName, 140);
          if (!docName) throw new Error('addQueueItem requires docName');
          const item = { docName, action: safeText(p?.action || 'Review & Approve', 60), priority: safeText(p?.priority || 'Medium', 20), status: safeText(p?.status || 'Waiting', 20), dateSubmitted: todayStr(), notes: safeText(p?.notes || '', 200), feedbackNotes: '' };
          await addQueue(item);
          msg = `Added queue item: ${docName}`;
        }
        else if (name === 'updateQueueItem') {
          const id = safeText(p?.id, 80);
          if (!id) throw new Error('updateQueueItem requires id');
          const updates: any = {};
          if (p.docName !== undefined) updates.docName = safeText(p.docName, 140);
          if (p.action !== undefined) updates.action = safeText(p.action, 60);
          if (p.priority !== undefined) updates.priority = safeText(p.priority, 20);
          if (p.status !== undefined) updates.status = safeText(p.status, 20);
          if (p.notes !== undefined) updates.notes = safeText(p.notes, 200);
          if (p.feedbackNotes !== undefined) updates.feedbackNotes = safeText(p.feedbackNotes, 800);
          await updateQueue(id, updates);
          msg = `Updated queue item: ${id}`;
        }
        else if (name === 'deleteQueueItem') {
          const id = safeText(p?.id, 80);
          if (!id) throw new Error('deleteQueueItem requires id');
          await deleteQueue(id);
          msg = `Deleted queue item: ${id}`;
        }
        else if (name === 'setCompetencyStatus') {
          const id = Number(p?.id);
          const field = (p?.field || '').toString();
          const value = safeText(p?.value, 200);
          if (!Number.isFinite(id)) throw new Error('setCompetencyStatus requires numeric id');
          if (!['compDoc','scoringTemplate','notes'].includes(field)) throw new Error('Invalid competency field');
          
          const existing = compList.find(c => c.compId === id);
          if (existing) {
            await updateCompStatus(existing.id!, { [field]: value });
          } else {
            await addCompStatus({ compId: id, compDoc: 'Not Started', scoringTemplate: 'Not Started', notes: '', [field]: value });
          }
          msg = `Updated competency ${id} ${field}`;
        }
        else if (name === 'addCompetency') {
          const name = safeText(p?.name, 120);
          const domain = safeText(p?.domain, 80) || 'Custom';
          if (!name) throw new Error('addCompetency requires name');
          const maxId = allCompetencies.reduce((m, c) => Math.max(m, Number(c.id) || 0), 0);
          const nextId = maxId + 1;
          setCustomCatalog(prev => [...prev, { id: nextId, name, domain }]);

          const compDoc = safeText(p?.compDoc || 'Not Started', 40);
          const scoringTemplate = safeText(p?.scoringTemplate || 'Not Started', 40);
          const notes = safeText(p?.notes || '', 200);
          await addCompStatus({ compId: nextId, compDoc, scoringTemplate, notes });

          if (p?.createDocPlaceholders) {
            const v = safeText(p?.version || notes || 'v1', 12) || 'v1';
            const today = todayStr();
            await addItemDoc({ name: `${name}_Competency`, category: 'Competency Documents', version: v, url: 'placeholder', status: 'Draft', notes: '', dateAdded: today });
            await addItemDoc({ name: `${name}_ScoringTemplate`, category: 'Scoring Templates', version: v, url: 'placeholder', status: 'Draft', notes: '', dateAdded: today });
          }
          msg = `Added competency: ${nextId}. ${name}`;
        }
        else if (name === 'setTimer') {
          const mode = (p?.mode || '').toString();
          let next = { ...timerState };
          if (mode === 'start') {
            if (!next.running) next = { ...next, running: true, startTimestamp: Date.now(), label: safeText(p?.label || next.label || 'Work Session', 80) };
          } else if (mode === 'stop') {
            if (next.running && next.startTimestamp) {
              const elapsed = Math.floor((Date.now() - next.startTimestamp) / 1000) + (next.elapsedAtStop || 0);
              next = { ...next, running: false, startTimestamp: null, elapsedAtStop: elapsed };
            }
          } else if (mode === 'reset') {
            next = { running: false, startTimestamp: null, label: '', elapsedAtStop: 0 };
          }
          await setTimerState(next);
          msg = `Timer ${mode}`;
        }

        if (msg) results.push({ ok: true, action: name, message: msg });
      } catch(e: any) {
        results.push({ ok: false, action: name, error: e?.message || 'Action failed' });
      }
    }
    return results;
  }

  async function confirmEnvelope(approve: boolean) {
    if (!pendingEnvelope) return;
    const { env, nextMessages } = pendingEnvelope;
    setPendingEnvelope(null);
    setLoading(true);
    
    if (approve) {
      const results = await runActions(env);
      const okCount = results.filter((r: any) => r.ok).length;
      await setChatData({ messages: [...nextMessages, { role: 'assistant', content: env.message || `Executed ${okCount} action(s) successfully.` }] });
    } else {
      await setChatData({ messages: [...nextMessages, { role: 'assistant', content: `[Actions Rejected by User] ${env.message || ''}` }] });
    }
    setLoading(false);
  }

  async function sendMessage(quickText?: string) {
    let userMsg = (quickText || input).trim();
    if (!userMsg || loading || pendingEnvelope) return;
    if (!quickText) setInput('');

    // Security: Sanitize input by removing any potential injected JSON envelopes
    userMsg = userMsg.replace(/<json>[\s\S]*?<\/json>/gi, '[JSON payload stripped for security]');

    const nextMessages = [...messages, { role: 'user', content: userMsg }];
    await setChatData({ messages: nextMessages });

    setLoading(true);
    try {
      const context = buildContext();
      const systemPrompt = `You are an assistant for the "VA Session Manager".
You can answer questions AND request safe, predefined actions.
IMPORTANT:
- Only use the allowed actions below.
- When you want the app to change data, output ONE JSON envelope between <json>...</json> and nothing else.
- If no actions are needed, respond normally in plain text and DO NOT include <json>.

Allowed actions:
- addDocument: { name, category, version?, url?, status?, notes? }
- updateDocument: { id, name?, category?, version?, url?, status?, notes? }
- deleteDocument: { id }
- addQueueItem: { docName, action?, priority?, status?, notes? }
- updateQueueItem: { id, docName?, action?, priority?, status?, notes?, feedbackNotes? }
- deleteQueueItem: { id }
- setCompetencyStatus: { id, field: 'compDoc'|'scoringTemplate'|'notes', value }
- addCompetency: { name, domain?, compDoc?, scoringTemplate?, notes?, createDocPlaceholders?: boolean, version?: string }
- setTimer: { mode: 'start'|'stop'|'reset', label?: string }

Envelope format:
<json>{"type":"actions","actions":[{"action":"addDocument","params":{...}}],"message":"Short human message."}</json>

${context}`;

      let rawText = '';
      
      const payload = {
        model: settings?.model || 'qwen/qwen-plus',
        systemPrompt,
        messages: nextMessages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      };

      const result = await window.electronAPI.chatRelay(payload);
      if (result.error) throw new Error(result.error);
      if (!result.text) throw new Error("No response text received from AI");
      
      rawText = result.text;
      
      const m = rawText.match(/<json>\s*([\s\S]*?)\s*<\/json>/i);
      if (m) {
        try {
          const env = JSON.parse(m[1]);
          if (env.type === 'actions') {
             // Security: Prompt user instead of auto-executing
             setPendingEnvelope({ env, rawText, nextMessages });
             return;
          }
        } catch(e) {
          await setChatData({ messages: [...nextMessages, { role: 'assistant', content: rawText }] });
        }
      } else {
        await setChatData({ messages: [...nextMessages, { role: 'assistant', content: rawText }] });
      }
    } catch(e: any) {
      await setChatData({ messages: [...nextMessages, { role: 'assistant', content: `Error: ${e.message}` }] });
    } finally {
      if (!pendingEnvelope) setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <div className="chat-panel" style={{ width: '100%', height: 640, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: 'var(--text-accent)', textTransform: 'uppercase' }}>Axiometric AI</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Ask about your progress & next steps</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 13, padding: '3px 8px', borderRadius: 3, fontFamily: "var(--font-mono)" }}>x </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CHAT_QUICK_PROMPTS.map(q => (
                    <button key={q} onClick={() => sendMessage(q)} className="btn-secondary" style={{ textAlign: 'left', fontSize: 11 }}>{q}</button>
                  ))}
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ flexShrink: 0, marginTop: 4 }}>
                      <Logo size={24} />
                    </div>
                  )}
                  <div className={msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'} style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8 }}>{msg.content}</div>
                </div>
              ))}
              {loading && !pendingEnvelope && (
                <div style={{ display: 'flex', gap: 10, padding: 10 }}>
                  <Logo size={24} className="timer-running" />
                  <div className="chat-msg-ai" style={{ padding: '8px 12px', display: 'flex', gap: 4 }}>
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: 4, height: 4, background: 'currentColor', borderRadius: '50%' }} />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} style={{ width: 4, height: 4, background: 'currentColor', borderRadius: '50%' }} />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} style={{ width: 4, height: 4, background: 'currentColor', borderRadius: '50%' }} />
                  </div>
                </div>
              )}
              {pendingEnvelope && (
                <div style={{ maxWidth: '88%', display: 'flex', gap: 10, alignSelf: 'flex-start' }}>
                  <div style={{ flexShrink: 0, marginTop: 4 }}><Logo size={24} /></div>
                  <div className="chat-msg-ai" style={{ width: '100%', padding: '16px', fontSize: 13, borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                     <div style={{ marginBottom: 12, fontWeight: 600, color: 'var(--text-primary)' }}>The AI proposes the following actions:</div>
                     <div style={{ background: 'var(--bg-base)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>
                       {pendingEnvelope.env.actions?.slice(0, 5).map((a: any, idx: number) => (
                         <div key={idx} style={{ padding: '6px 0', borderBottom: idx < (Math.min(pendingEnvelope.env.actions.length, 5) - 1) ? '1px solid var(--border-subtle)' : 'none', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)', fontWeight: 600 }}>{a.action}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{JSON.stringify(a.params).slice(0, 100)}{JSON.stringify(a.params).length > 100 ? '...' : ''}</span>
                         </div>
                       ))}
                       {pendingEnvelope.env.actions?.length > 5 && <div style={{ color: 'var(--status-amber)', fontSize: 11, marginTop: 8 }}>+ {pendingEnvelope.env.actions.length - 5} more discarded</div>}
                     </div>
                     <div style={{ display: 'flex', gap: 10 }}>
                       <button onClick={() => confirmEnvelope(true)} className="btn-success" style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>Approve & Execute</button>
                       <button onClick={() => confirmEnvelope(false)} className="btn-danger" style={{ flex: 1, padding: '8px 0', fontSize: 12 }}>Reject</button>
                     </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
              <div ref={messagesEndRef} />
        </div>
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && sendMessage()} 
            placeholder={"Ask anything..."} 
            style={{ flex: 1 }} 
          />
          <button disabled={loading} className="btn-primary" onClick={() => sendMessage()} style={{ padding: '0 16px' }}>
            <Sparkles size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
