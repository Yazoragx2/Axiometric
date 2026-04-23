import React, { useState, useEffect } from 'react';
import { useCatalog } from '../CatalogContext';
import { useFirestore, useFirestoreDoc } from '../hooks/useFirestore';
import { formatDate, todayStr, fmtHHMMSS } from '../utils';
import { CompetencyStatus, QueueItem, Session, Document, TimerState } from '../types';
import { usePermissions } from '../hooks/usePermissions';

import { Logo } from './Logo';

interface DashboardTabProps {
  onNavigate: (tab: string) => void;
}

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

export function DashboardTab({ onNavigate }: DashboardTabProps) {
  const { domains, allCompetencies, totalCompetencies } = useCatalog();
  const { team } = usePermissions();
  const { data: compList } = useFirestore<CompetencyStatus>('competencies', { teamId: team?.id });
  const { data: queue } = useFirestore<QueueItem>('queue', { teamId: team?.id });
  const { data: sessions } = useFirestore<Session>('hours');
  const { data: docs } = useFirestore<Document>('documents', { teamId: team?.id });
  const { data: timerState } = useFirestoreDoc<TimerState>('timer', 'current', { running: false, startTimestamp: null, label: '', elapsedAtStop: 0 });

  const comps = React.useMemo(() => {
    const map: Record<number, CompetencyStatus> = {};
    compList.forEach(c => { map[c.compId] = c; });
    return map;
  }, [compList]);

  const [timerElapsed, setTimerElapsed] = useState(0);

  useEffect(() => {
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = todayStr();

  const approvedDocs = allCompetencies.filter(c => comps[c.id]?.compDoc === "Approved").length;
  const approvedScoring = allCompetencies.filter(c => comps[c.id]?.scoringTemplate === "Approved").length;
  const waitingItems = queue.filter(q => q.status === 'Waiting');
  const todaySessions = sessions.filter(s => s.date === today);

  const calcHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins <= 0 ? 0 : mins / 60;
  };

  const todayHours = todaySessions.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime), 0);
  const fmtDuration = (h: number) => {
    if (!h) return '0m';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const quickLinks = docs.filter(d => d.url && d.url !== 'placeholder').slice(0, 7);
  const inProgressComps = allCompetencies.filter(c => {
    const cd = comps[c.id]?.compDoc;
    const st = comps[c.id]?.scoringTemplate;
    return cd === 'In Progress' || cd === 'Pending Boss’s Queue Review' || st === 'In Progress' || st === 'Pending Boss’s Queue Review';
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{greeting}.</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Phase 2</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            {formatDate(today)}
          </p>
        </div>
        <div style={{ opacity: 0.15, transform: 'rotate(-15deg)' }}>
          <Logo size={64} />
        </div>
      </div>

      {timerState.running && (
        <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-muted)', borderRadius: 4, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)" }}>
            &gt; Session timer running  -  {timerState.label || 'Work Session'}
          </span>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => onNavigate('session-start')}>
            Go to Session Start -&gt;
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => onNavigate('competency-tracker')}>
          <div style={{ fontSize: 11, fontFamily:"var(--font-mono)", color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Competency Docs</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily:"var(--font-mono)", color: approvedDocs === totalCompetencies ? 'var(--status-green)' : 'var(--text-primary)', marginBottom: 8 }}>{approvedDocs} <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>/ {totalCompetencies}</span></div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${(approvedDocs/Math.max(1,totalCompetencies))*100}%`, background: 'var(--status-blue)' }} />
          </div>
        </div>

        <div className="card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => onNavigate('competency-tracker')}>
          <div style={{ fontSize: 11, fontFamily:"var(--font-mono)", color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scoring Templates</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily:"var(--font-mono)", color: approvedScoring === totalCompetencies ? 'var(--status-green)' : 'var(--text-primary)', marginBottom: 8 }}>{approvedScoring} <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>/ {totalCompetencies}</span></div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${(approvedScoring/Math.max(1,totalCompetencies))*100}%`, background: 'var(--status-green)' }} />
          </div>
        </div>

        <div className="card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => onNavigate('jake-queue')}>
          <div style={{ fontSize: 11, fontFamily:"var(--font-mono)", color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Boss’s Queue</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily:"var(--font-mono)", color: waitingItems.length > 0 ? 'var(--status-amber)' : 'var(--status-green)', marginBottom: 8 }}>{waitingItems.length} <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>waiting</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{queue.length} total item{queue.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => onNavigate('hours-pay')}>
          <div style={{ fontSize: 11, fontFamily:"var(--font-mono)", color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Today's Hours</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily:"var(--font-mono)", color: 'var(--text-primary)', marginBottom: 8 }}>{fmtDuration(todayHours)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''} today</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontFamily:"var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Waiting on Boss’s Queue</h3>
            <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => onNavigate('jake-queue')}>View All -&gt;</button>
          </div>
          {waitingItems.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--status-green)' }}>Nothing waiting  -  all clear!</p>
          ) : (
            waitingItems.slice(0, 5).map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.docName}</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize: 10, padding: '2px 6px', borderRadius: 2, background: item.priority==='High' ? 'rgba(224,92,106,0.12)' : item.priority==='Medium' ? 'rgba(240,160,75,0.12)' : 'rgba(91,138,240,0.12)', color: item.priority==='High' ? 'var(--status-red)' : item.priority==='Medium' ? 'var(--status-amber)' : 'var(--status-blue)', marginLeft: 8, flexShrink: 0 }}>
                  {item.priority}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontFamily:"var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>Quick Links</h3>
            <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => onNavigate('document-store')}>All Docs -&gt;</button>
          </div>
          {quickLinks.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No documents with links yet.</p>
          ) : (
            quickLinks.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </a>
                <span style={{ fontFamily:"var(--font-mono)", fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>{doc.version}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12, marginBottom: 16 }}>
          <h3 style={{ fontFamily:"var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-accent)' }}>Phase 2 Domain Progress</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {domains.map(domain => {
            const total = domain.competencies.length;
            const approved = domain.competencies.filter(c => comps[c.id]?.compDoc === 'Approved').length;
            return (
              <div key={domain.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{domain.name}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize: 11, color: 'var(--text-secondary)' }}>{approved}/{total}</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${(approved/total)*100}%`, background: 'var(--accent)' }} />
                </div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{approved}/{total} approved</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12, marginBottom: 16 }}>
          <h3 style={{ fontFamily:"var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-accent)' }}>In Progress / Pending Review</h3>
        </div>
        {inProgressComps.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No competencies currently in progress.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inProgressComps.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 160, color: 'var(--text-primary)' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Comp Doc:</span>
                  <StatusBadge status={comps[c.id]?.compDoc || 'Not Started'} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>Template:</span>
                  <StatusBadge status={comps[c.id]?.scoringTemplate || 'Not Started'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
