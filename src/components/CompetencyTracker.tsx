import React, { useState, useEffect } from 'react';
import { useCatalog } from '../CatalogContext';
import { useFirestore } from '../hooks/useFirestore';
import { STATUS_OPTIONS } from '../constants';
import { todayStr } from '../utils';
import { CompetencyStatus, Document } from '../types';
import { usePermissions } from '../hooks/usePermissions';

export function CompetencyTracker() {
  const { team } = usePermissions();
  const { domains, allCompetencies, totalCompetencies, addCustomCompetency } = useCatalog();
  const { data: compList, addItem: addCompStatus, updateItem: updateCompStatus } = useFirestore<CompetencyStatus>('competencies', { teamId: team?.id });
  const { addItem: addDoc } = useFirestore<Document>('documents', { teamId: team?.id });

  const comps = React.useMemo(() => {
    const map: Record<number, CompetencyStatus> = {};
    compList.forEach(c => { map[c.compId] = c; });
    return map;
  }, [compList]);

  const [openDomains, setOpenDomains] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    for (let i = 0; i < Math.max(1, domains.length); i++) init[i] = true;
    return init;
  });

  useEffect(() => {
    setOpenDomains(prev => {
      const next = { ...prev };
      for (let i = 0; i < domains.length; i++) {
        if (next[i] === undefined) next[i] = true;
      }
      return next;
    });
  }, [domains.length]);

  // Ensure all competencies have a status record in Firestore
  useEffect(() => {
    allCompetencies.forEach(async (c) => {
      if (!comps[c.id]) {
        try {
          await addCompStatus({
            compId: c.id,
            compDoc: "Not Started",
            scoringTemplate: "Not Started",
            notes: ""
          });
        } catch (e) {
          // Likely already exists or permission issue
        }
      }
    });
  }, [allCompetencies, comps, addCompStatus]);

  const approved_docs = allCompetencies.filter(c => comps[c.id]?.compDoc === "Approved").length;
  const approved_scoring = allCompetencies.filter(c => comps[c.id]?.scoringTemplate === "Approved").length;

  const [showAddComp, setShowAddComp] = useState(false);
  const [newComp, setNewComp] = useState({
    name: '',
    domain: (domains[0]?.name || 'Custom'),
    newDomain: '',
    compDoc: 'Not Started',
    scoringTemplate: 'Not Started',
    notes: '',
    createDocPlaceholders: true,
  });

  const handleUpdateComp = async (compId: number, field: keyof CompetencyStatus, value: string) => {
    const existing = compList.find(c => c.compId === compId);
    if (existing && existing.id) {
      await updateCompStatus(existing.id, { [field]: value });
    } else {
      await addCompStatus({
        compId,
        compDoc: "Not Started",
        scoringTemplate: "Not Started",
        notes: "",
        [field]: value
      });
    }
  };

  const toggleDomain = (idx: number) => {
    setOpenDomains(p => ({...p, [idx]: !p[idx]}));
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>Competency Tracker</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 0 }}>Track documentation progress for all {totalCompetencies} competencies in the Axiometric Framework.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddComp(s => !s)}>
          {showAddComp ? 'x  Cancel' : '+ Add New Competency'}
        </button>
      </div>

      {showAddComp && (
        <div className="card" style={{ padding: 20, marginTop: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Add New Competency</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Competency name *</label>
              <input value={newComp.name} onChange={e=>setNewComp(p=>({...p,name:e.target.value}))} placeholder="e.g. Asymmetry" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Domain</label>
              <select value={newComp.domain} onChange={e=>setNewComp(p=>({...p,domain:e.target.value}))}>
                {Array.from(new Set(domains.map(d => d.name))).map(dn => <option key={dn} value={dn}>{dn}</option>)}
                <option value="__new__">+ New domain...</option>
              </select>
            </div>
            {newComp.domain === '__new__' && (
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>New domain name *</label>
                <input value={newComp.newDomain} onChange={e=>setNewComp(p=>({...p,newDomain:e.target.value}))} placeholder="e.g. Strategic Disposition" />
              </div>
            )}
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Competency doc status</label>
              <select value={newComp.compDoc} onChange={e=>setNewComp(p=>({...p,compDoc:e.target.value}))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Scoring template status</label>
              <select value={newComp.scoringTemplate} onChange={e=>setNewComp(p=>({...p,scoringTemplate:e.target.value}))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display:'block', fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>Notes</label>
              <input value={newComp.notes} onChange={e=>setNewComp(p=>({...p,notes:e.target.value}))} placeholder="Optional (e.g. v1)" />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={!!newComp.createDocPlaceholders}
                onChange={e=>setNewComp(p=>({...p,createDocPlaceholders:e.target.checked}))}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Create Document Store placeholders (competency doc + scoring template)</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:14, flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={async () => {
                const name = newComp.name.trim();
                const domainName = newComp.domain === '__new__' ? newComp.newDomain.trim() : newComp.domain.trim();
                if (!name) return;
                if (!domainName) return;

                const maxId = allCompetencies.reduce((m, c) => Math.max(m, Number(c.id) || 0), 0);
                const nextId = maxId + 1;

                await addCustomCompetency({ name, domain: domainName });
                await addCompStatus({
                  compId: nextId,
                  compDoc: newComp.compDoc,
                  scoringTemplate: newComp.scoringTemplate,
                  notes: newComp.notes || ""
                });

                if (newComp.createDocPlaceholders) {
                  const v = (newComp.notes || 'v1').trim() || 'v1';
                  const today = todayStr();
                  await addDoc({ name: `${name}_Competency`, category: 'Competency Documents', version: v, url: 'placeholder', status: 'Draft', notes: '', dateAdded: today });
                  await addDoc({ name: `${name}_ScoringTemplate`, category: 'Scoring Templates', version: v, url: 'placeholder', status: 'Draft', notes: '', dateAdded: today });
                }

                setNewComp({
                  name: '',
                  domain: (domains[0]?.name || 'Custom'),
                  newDomain: '',
                  compDoc: 'Not Started',
                  scoringTemplate: 'Not Started',
                  notes: '',
                  createDocPlaceholders: true,
                });
                setShowAddComp(false);
              }}
            >
              Add Competency
            </button>
            <button className="btn-secondary" onClick={() => setShowAddComp(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Competency Documents</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize: 12, fontWeight: 600, color: approved_docs === totalCompetencies ? 'var(--status-green)' : 'var(--text-primary)' }}>{approved_docs} / {totalCompetencies}</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${(approved_docs/Math.max(1,totalCompetencies))*100}%`, background: 'var(--status-blue)' }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Scoring Templates</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize: 12, fontWeight: 600, color: approved_scoring === totalCompetencies ? 'var(--status-green)' : 'var(--text-primary)' }}>{approved_scoring} / {totalCompetencies}</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${(approved_scoring/Math.max(1,totalCompetencies))*100}%`, background: 'var(--status-green)' }} />
            </div>
          </div>
        </div>
      </div>

      {domains.map((domain, idx) => (
        <div key={domain.name} style={{ marginBottom: 4 }}>
          <div className="domain-header" onClick={() => toggleDomain(idx)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: openDomains[idx] ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12 }}>{openDomains[idx] ? 'v' : '>'}</span>
              <span style={{ fontFamily:"var(--font-mono)", fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>{domain.name}</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize: 10, color: 'var(--text-muted)' }}>
                [{domain.competencies.filter(c=>comps[c.id]?.compDoc==="Approved").length}/{domain.competencies.length}]
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize: 11, color: 'var(--text-muted)' }}>
                Docs: {domain.competencies.filter(c=>comps[c.id]?.compDoc==="Approved").length}/{domain.competencies.length}
              </span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize: 11, color: 'var(--text-muted)' }}>
                Templates: {domain.competencies.filter(c=>comps[c.id]?.scoringTemplate==="Approved").length}/{domain.competencies.length}
              </span>
            </div>
          </div>

          {openDomains[idx] && (
            <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden', borderRadius: 3 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-base)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily:"var(--font-mono)", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', width: 40, borderBottom: '1px solid var(--border-default)' }}>#</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily:"var(--font-mono)", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: '1px solid var(--border-default)' }}>Competency</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily:"var(--font-mono)", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', width: 200, borderBottom: '1px solid var(--border-default)' }}>Comp Doc Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily:"var(--font-mono)", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', width: 200, borderBottom: '1px solid var(--border-default)' }}>Scoring Template</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily:"var(--font-mono)", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: '1px solid var(--border-default)' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {domain.competencies.map((c, ci) => (
                    <tr key={c.id} style={{ borderTop: ci > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontFamily:"var(--font-mono)", fontSize: 12, fontWeight: 600, color: 'var(--text-accent)' }}>{String(c.id).padStart(2,'0')}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <select
                          value={comps[c.id]?.compDoc || "Not Started"}
                          onChange={e => handleUpdateComp(c.id, 'compDoc', e.target.value)}
                          style={{ fontSize: 12, padding: '5px 8px' }}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <select
                          value={comps[c.id]?.scoringTemplate || "Not Started"}
                          onChange={e => handleUpdateComp(c.id, 'scoringTemplate', e.target.value)}
                          style={{ fontSize: 12, padding: '5px 8px' }}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <input
                          value={comps[c.id]?.notes || ""}
                          onChange={e => handleUpdateComp(c.id, 'notes', e.target.value)}
                          placeholder="Notes..."
                          style={{ fontSize: 12, padding: '5px 8px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
