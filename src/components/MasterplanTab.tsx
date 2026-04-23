import React, { useState } from 'react';
import { CompetencyStatus } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { auth } from '../firebase';
import { useFirestore, useFirestoreDoc } from '../hooks/useFirestore';
import { useCatalog } from '../CatalogContext';

const PHASE_DATA = [
  {
    id: 1,
    name: 'Framework Design',
    summary: 'Domain structure, 18 competencies defined, foundation templates, proof-of-concept competency.',
    outputs: [
      'Objective Criteria for the Ideal VA (v2)',
      '4-domain structure with 18 competencies defined',
      'Stipulative definitions + observable behaviours per competency',
      'Competency Foundation Template + Scoring Template Foundation',
      'Direct Communication competency v1->v7 (proof-of-concept)',
    ],
    advanceNote: null,
    unlockKey: null,
  },
  {
    id: 2,
    name: 'Competency Build',
    summary: 'Full competency documents and scoring templates built for all competencies across all domains.',
    outputs: [
      'Full competency document per competency (4 dimensions, L1 - L4 BARS rubric)',
      'Scoring template per competency',
      'Perplexity AI + Google Scholar research preceding each build',
      'Methodological synthesis + 12-decision design log + criterion validity targets per document',
      'All 18 rubrics loaded into Axiometric Scoring Agent (Boss’s Queue)',
    ],
    advanceNote: null,
    unlockKey: null,
  },
  {
    id: 3,
    name: 'Calibration & Rater Training',
    summary: 'Real work samples collected. Two-rater protocol tested. Inter-rater agreement calculated.',
    outputs: [
      'Real VA work samples collected per competency',
      'Evaluator training on rubric using scoring templates',
      'Two-rater protocol applied to live samples',
      'Inter-rater agreement rates calculated across all 18 competencies',
      'Anchors producing disagreement flagged for Phase 4 revision',
    ],
    advanceNote: 'Target: >=80% same-level agreement, 100% within-one-level agreement across all 18 competencies.',
    unlockKey: 'phase3',
  },
  {
    id: 4,
    name: 'Anchor Validation',
    summary: '"Pattern:" placeholders replaced with confirmed real evidence. Spacing and hierarchy psychometrically verified.',
    outputs: [
      '"Pattern:" placeholder anchors replaced with confirmed VA work sample evidence',
      'Thurstone equal-appearing intervals  -  anchor spacing verified',
      'Guttman scalogram analysis  -  cumulative hierarchy confirmed (L1 < L2 < L3 < L4)',
      'Semantic Differential audit of anchor language for tone/bias',
      'Gaming-resistant dimensions stress-tested',
      'OC document updated with final observable behaviours from real samples',
    ],
    advanceNote: 'Requires Phase 3 complete.',
    unlockKey: 'phase4',
  },
  {
    id: 5,
    name: 'Rasch / IRT Psychometric Validation',
    summary: 'Ordinal restriction lifted. Interval-level properties established. Framework fully operational.',
    outputs: [
      'Ordinal restriction ("do not average or sum") formally lifted after interval validation',
      'Rasch model or IRT applied to establish interval-level score properties',
      'VA scores meaningfully comparable across dimensions and individuals',
      'Scores aggregable for workforce analytics',
      'Framework declared fully operational',
    ],
    advanceNote: 'Requires Phase 4 complete. Final validation step before framework is fully operational.',
    unlockKey: 'phase5',
  },
];

const STATUS_CYCLE = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'];

function phaseStatusBadgeClass(status: string) {
  if (status === 'COMPLETE')    return 'badge badge-green';
  if (status === 'IN_PROGRESS') return 'badge badge-amber';
  if (status === 'NOT_STARTED') return 'badge badge-grey';
  return 'badge badge-grey';
}

function phaseStatusLabel(status: string) {
  if (status === 'COMPLETE')    return 'Complete';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'NOT_STARTED') return 'Not Started';
  if (status === 'LOCKED')      return 'Locked';
  return 'Not Started';
}

function phaseCircleColor(status: string) {
  if (status === 'COMPLETE')    return { border: '1px solid #22d48a', color: '#22d48a', background: 'rgba(34,212,138,0.08)' };
  if (status === 'IN_PROGRESS') return { border: '1px solid #f0a04b', color: '#f0a04b', background: 'rgba(240,160,75,0.08)' };
  return { border: '1px solid #262c38', color: '#4a5568', background: 'transparent' };
}

export function MasterplanTab() {
  const { team, isAdmin } = usePermissions();
  const { allCompetencies, totalCompetencies } = useCatalog();
  const { data: competencyData } = useFirestore<CompetencyStatus>('competencies', { teamId: team?.id });
  
  // Convert array to record for easy lookup
  const competencyRecord = competencyData.reduce((acc, curr) => {
    if (curr.compId) acc[curr.compId] = curr;
    return acc;
  }, {} as Record<number, CompetencyStatus>);

  const { data: phaseProgress, setDocData: setPhaseProgress } = useFirestoreDoc<any>('masterplan', 'phases', {
    phase3: 'NOT_STARTED',
    phase4: 'NOT_STARTED',
    phase5: 'NOT_STARTED'
  }, { teamId: team?.id });

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const builtCount = allCompetencies.filter(c => competencyRecord[c.id]?.compDoc !== 'Not Started').length;
  const phase2Status = builtCount === totalCompetencies ? 'COMPLETE' : builtCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

  function getPhaseStatus(id: number) {
    if (id === 1) return 'COMPLETE';
    if (id === 2) return phase2Status;
    const key = `phase${id}`;
    const prereqStatus = id === 3 ? phase2Status : phaseProgress[`phase${id - 1}`];
    if (prereqStatus !== 'COMPLETE') return 'LOCKED';
    return phaseProgress[key] || 'NOT_STARTED';
  }

  async function handleCycleStatus(phase: any) {
    if (!isAdmin) return;
    const key = phase.unlockKey;
    const current = phaseProgress[key] || 'NOT_STARTED';
    const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
    try {
      const modifierNickname = team?.members && auth.currentUser 
        ? team.members[auth.currentUser.uid]?.nickname 
        : 'Unknown';
      
      await setPhaseProgress({ 
        ...phaseProgress, 
        [key]: STATUS_CYCLE[nextIdx],
        [`${key}_lastModifiedBy`]: modifierNickname,
        [`${key}_lastModifiedAt`]: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error updating phase progress:', e);
    }
  }

  function toggleExpand(id: number) {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
  }

  const completedCount = [1, 2, 3, 4, 5].filter(id => getPhaseStatus(id) === 'COMPLETE').length;

  const activePhaseId = (() => {
    for (let i = 1; i <= 5; i++) {
      if (getPhaseStatus(i) === 'IN_PROGRESS') return i;
    }
    for (let i = 1; i <= 5; i++) {
      if (getPhaseStatus(i) === 'NOT_STARTED') return i;
    }
    return null;
  })();

  return (
    <div className="tab-content">
      <div style={{ maxWidth: 860, padding: '28px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
            letterSpacing: '0.15em', color: 'var(--text-accent)', textTransform: 'uppercase',
            marginBottom: 4 }}>
            Axiometric Framework
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 500,
            color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Masterplan
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: 'var(--text-muted)',
            marginTop: 2 }}>
            Phase tracker  -  psychometric validation pipeline
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
              letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Framework Progress
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
              color: 'var(--text-accent)' }}>
              {completedCount} / 5 phases complete
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3, height: 6 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ flex: 1, background: i <= completedCount ? 'var(--accent)' : 'var(--border-default)',
                borderRadius: 0, transition: 'background 0.3s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9,
                color: i <= completedCount ? 'var(--text-accent)' : 'var(--text-muted)',
                letterSpacing: '0.08em', textAlign: 'center' }}>
                P{i}
              </div>
            ))}
          </div>
        </div>

        {PHASE_DATA.map(phase => {
          const status = getPhaseStatus(phase.id);
          const isActive = phase.id === activePhaseId;
          const isLocked = status === 'LOCKED';
          const isExpanded = !!expanded[phase.id];
          const isClickable = phase.unlockKey && !isLocked;
          const circleStyle = phaseCircleColor(status);

          return (
            <div
              key={phase.id}
              className={`phase-card${isActive ? ' phase-active' : ''}${isLocked ? ' phase-locked' : ''}`}
            >
              <button className="phase-card-header" onClick={() => toggleExpand(phase.id)}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                  ...circleStyle }}>
                  {phase.id}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                    color: isLocked ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {phase.name}
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11,
                    color: 'var(--text-muted)', marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {phase.summary}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {phase.id === 2 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                      color: builtCount === totalCompetencies ? 'var(--status-green)' : 'var(--text-muted)' }}>
                      {builtCount}/{totalCompetencies}
                    </span>
                  )}
                  {isLocked ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                      color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                      LOCKED
                    </span>
                  ) : (
                    <span
                      className={`${phaseStatusBadgeClass(status)}${isClickable ? ' cursor-pointer hover:filter hover:brightness-125' : ''}`}
                      onClick={isClickable ? (e) => { e.stopPropagation(); handleCycleStatus(phase); } : undefined}
                    >
                      {phaseStatusLabel(status)}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: "var(--font-mono)" }}>
                    {isExpanded ? 'v' : '>'}
                  </span>
                </div>
              </button>

              <div className="phase-card-body-wrap" style={{ maxHeight: isExpanded ? 800 : 0 }}>
                <div className="phase-card-body">
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 12,
                    color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                    {phase.summary}
                  </p>

                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                    letterSpacing: '0.14em', color: 'var(--text-muted)',
                    textTransform: 'uppercase', marginBottom: 4 }}>
                    Key Outputs
                  </div>
                  <ul className="phase-outputs">
                    {phase.outputs.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>

                  {phase.id === 2 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                        marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                          letterSpacing: '0.12em', color: 'var(--text-muted)',
                          textTransform: 'uppercase' }}>
                          Competency Build Progress
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                          color: builtCount === totalCompetencies ? 'var(--status-green)' : 'var(--status-amber)' }}>
                          {builtCount} / {totalCompetencies}
                        </span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill"
                          style={{ width: `${(builtCount / Math.max(1,totalCompetencies)) * 100}%`,
                            background: builtCount === totalCompetencies ? 'var(--status-green)' : 'var(--accent)' }} />
                      </div>
                    </div>
                  )}

                  {phase.advanceNote && (
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 11,
                      color: 'var(--text-muted)', fontStyle: 'italic',
                      marginTop: 14, lineHeight: 1.5 }}>
                      {phase.advanceNote}
                    </p>
                  )}

                  {phase.unlockKey && (
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9,
                        letterSpacing: '0.12em', color: 'var(--text-muted)',
                        textTransform: 'uppercase' }}>
                        Status
                      </span>
                      {isLocked ? (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10,
                          color: 'var(--text-muted)' }}>
                          Unlocks when Phase {phase.id - 1} is complete
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              className={`${phaseStatusBadgeClass(status)}${isAdmin ? ' cursor-pointer hover:filter hover:brightness-125' : ''}`}
                              onClick={isAdmin ? () => handleCycleStatus(phase) : undefined}
                            >
                              {phaseStatusLabel(status)}
                            </span>
                            {isAdmin && (
                              <span style={{ fontFamily: "var(--font-sans)", fontSize: 10,
                                color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                click to advance
                              </span>
                            )}
                          </div>
                          {phaseProgress[`${phase.unlockKey}_lastModifiedBy`] && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 12 }}>
                              Modified by: <span style={{ color: 'var(--text-accent)' }}>{phaseProgress[`${phase.unlockKey}_lastModifiedBy`]}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
