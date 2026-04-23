import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  Target, 
  BarChart3, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  PlayCircle, 
  Download, 
  AlertCircle,
  FileText,
  LogOut,
  ChevronRight,
  TrendingUp,
  Search,
  CheckCircle2,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { cn } from '../../lib/utils';
import { Background } from './Background';
import { useFirestore, useFirestoreDoc } from '../../hooks/useFirestore';
import { auth } from '../../firebase';

// TYPES
export interface Competency {
  id: string;
  title: string;
  description: string;
  weight: number;
}

export interface ScoringTemplate {
  id: string;
  title: string;
  content: string;
}

export interface WorkSample {
  id: string;
  type: 'text' | 'document' | 'message' | 'other';
  content: string;
  timestamp: string;
}

export interface Candidate {
  id: string;
  name: string;
  workSamples: WorkSample[];
}

export interface EvaluationResult {
  candidateId: string;
  overallScore: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  competencyBreakdown: {
    competencyId: string;
    name: string;
    score: number;
    confidence: 'High' | 'Medium' | 'Low';
    justification: string;
    evidence: string[];
  }[];
  patterns: {
    strengths: string[];
    weaknesses: string[];
    behavioralPatterns: string[];
  };
  recommendations: string[];
  timestamp: string;
}

// CONSTANTS
const PREDEFINED_COMPETENCIES: Competency[] = [
  { id: 'c1', title: 'Direct Communication', description: 'Ability to communicate clearly and concisely without ambiguity.', weight: 3 },
  { id: 'c2', title: 'Task Prioritization', description: 'Effectively managing multiple tasks based on urgency and importance.', weight: 4 },
  { id: 'c3', title: 'Proactive Reporting', description: 'Providing updates before being asked, anticipating needs.', weight: 3 },
  { id: 'c4', title: 'Semantic Clarity', description: 'Using precise language to ensure shared understanding.', weight: 3 },
  { id: 'c5', title: 'Technical Proficiency', description: 'Skill in using required software and tools efficiently.', weight: 5 },
  { id: 'c6', title: 'Attention to Detail', description: 'Maintaining high accuracy in work output and documentation.', weight: 4 },
];

const PREDEFINED_TEMPLATES: ScoringTemplate[] = PREDEFINED_COMPETENCIES.map(c => ({
  id: `t${c.id.slice(1)}`,
  title: `${c.title} Rubric`,
  content: `Score 1-2: Poor. Lacks basic understanding or execution of ${c.title}.\nScore 3-4: Developing. Shows some effort but inconsistent in ${c.title}.\nScore 5-6: Proficient. Consistently demonstrates ${c.title} in standard situations.\nScore 7-8: Advanced. High level of skill and proactive application of ${c.title}.\nScore 9-10: Expert. Exceptional mastery and sets a standard for ${c.title} for others.`
}));

// COMPONENTS
const NavItem = ({ active, icon: Icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-6 py-4 w-full transition-all relative group",
      active ? "text-teal-400" : "text-slate-500 hover:text-slate-200"
    )}
  >
    <Icon className={cn("w-5 h-5 transition-transform duration-300", active ? "scale-110" : "group-hover:scale-110")} />
    <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    {active && (
      <motion.div 
        layoutId="activeTabAgent"
        className="absolute left-0 w-1 h-8 bg-teal-400 rounded-r-full shadow-[0_0_15px_rgba(45,212,191,0.5)]" 
      />
    )}
  </button>
);

const CompetencyScoreItem: React.FC<{ item: any }> = ({ item }) => (
  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-teal-500/20 transition-all group">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h4 className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors">{item.name}</h4>
        <div className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-widest mt-1",
          item.confidence === 'High' ? 'text-teal-500 bg-teal-500/5 border-teal-500/10' :
          item.confidence === 'Medium' ? 'text-amber-500 bg-amber-500/5 border-amber-500/10' :
          'text-red-500 bg-red-500/5 border-red-500/10'
        )}>
          <div className={cn(
            "w-1 h-1 rounded-full",
            item.confidence === 'High' ? 'bg-teal-500' :
            item.confidence === 'Medium' ? 'bg-amber-500' :
            'bg-red-500'
          )} />
          {item.confidence} Confidence
        </div>
      </div>
      <div className="text-2xl font-mono font-bold text-teal-400">{item.score}</div>
    </div>
    <p className="text-[10px] text-slate-400 leading-relaxed mb-3 italic">"{item.justification}"</p>
    <div>
      <h5 className="text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-2">Evidence identified</h5>
      <ul className="space-y-1.5">
        {item.evidence.map((ev: string, i: number) => (
          <li key={i} className="text-[9px] text-slate-500 leading-relaxed bg-slate-950/30 p-2 rounded border border-slate-800/50">
            {ev}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

// MAIN MODULE COMPONENT
export function RubricAgentModule() {
  const [activeTab, setActiveTab] = useState('evaluation');
  
  // Data persistence via main app hooks
  const { data: competenciesDb, addItem: addComp, updateItem: updateComp, deleteItem: delComp } = useFirestore<Competency>('agent_competencies');
  const { data: templatesDb, addItem: addTemp, updateItem: updateTemp, deleteItem: delTemp } = useFirestore<ScoringTemplate>('agent_templates');
  const { data: candidatesDb, addItem: addCand, updateItem: updateCand, deleteItem: delCand } = useFirestore<Candidate>('agent_candidates');
  const { data: evaluationsDb, addItem: addEval, clearCollection: clearEvals } = useFirestore<EvaluationResult>('agent_evaluations');
  
  // Settings managed globally via Electron IPC

  // Merge predefined with DB
  const competencies = useMemo(() => {
    const dbIds = new Set(competenciesDb.map(c => c.id));
    return [...competenciesDb, ...PREDEFINED_COMPETENCIES.filter(c => !dbIds.has(c.id))];
  }, [competenciesDb]);

  const templates = useMemo(() => {
    const dbIds = new Set(templatesDb.map(t => t.id));
    return [...templatesDb, ...PREDEFINED_TEMPLATES.filter(t => !dbIds.has(t.id))];
  }, [templatesDb]);

  return (
    <div className="flex h-full text-slate-200 overflow-hidden">
      <Background />
      
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 bg-slate-950/40 backdrop-blur-xl border-r border-slate-800/50 flex flex-col pt-8">
        <div className="px-6 mb-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.3)]">
              <Target className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-white leading-none">Rubric Agent</h1>
              <p className="text-[8px] font-bold text-teal-500/60 uppercase tracking-tighter mt-1">Axiometric Evaluation</p>
            </div>
          </div>
        </div>

        <nav>
          <NavItem active={activeTab === 'evaluation'} icon={PlayCircle} label="Evaluation" onClick={() => setActiveTab('evaluation')} />
          <NavItem active={activeTab === 'comparison'} icon={BarChart3} label="Comparison" onClick={() => setActiveTab('comparison')} />
          <NavItem active={activeTab === 'candidates'} icon={Users} label="Candidates" onClick={() => setActiveTab('candidates')} />
          <NavItem active={activeTab === 'competencies'} icon={Target} label="Competencies" onClick={() => setActiveTab('competencies')} />
          <NavItem active={activeTab === 'templates'} icon={FileText} label="Templates" onClick={() => setActiveTab('templates')} />
          <NavItem active={activeTab === 'settings'} icon={Settings} label="Settings" onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="mt-auto p-6">
          <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/10">
            <p className="text-[9px] font-bold uppercase tracking-widest text-teal-500/40 mb-2">Active Intelligence</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
              <span className="text-[10px] font-mono text-slate-400">Gemini 1.5 Pro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'evaluation' && (
              <EvaluationEngine 
                candidates={candidatesDb} 
                competencies={competencies} 
                templates={templates} 
                evaluations={evaluationsDb} 
                setEvaluations={addEval}
              />
            )}
            {activeTab === 'comparison' && (
              <ComparisonView 
                candidates={candidatesDb} 
                evaluations={evaluationsDb} 
                competencies={competencies} 
              />
            )}
            {activeTab === 'candidates' && (
              <CandidateManager 
                candidates={candidatesDb} 
                setCandidates={addCand} 
              />
            )}
            {activeTab === 'competencies' && (
              <CompetencyManager 
                competencies={competencies} 
                setCompetencies={addComp} 
              />
            )}
            {activeTab === 'templates' && (
              <TemplateManager 
                templates={templates} 
                setTemplates={addTemp} 
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView 
                onResetData={clearEvals}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// SUB-COMPONENTS (Implementation of Manager Views)

function CompetencyManager({ competencies, setCompetencies }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [newComp, setNewComp] = useState({ title: '', description: '', weight: 3 });
  const [editingComp, setEditingComp] = useState<Competency | null>(null);

  const addCompetency = () => {
    if (!newComp.title) return;
    setCompetencies({ ...newComp, id: 'c' + Date.now() });
    setNewComp({ title: '', description: '', weight: 3 });
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Competency Library</h2>
          <p className="text-slate-400 text-sm">Define the behaviors and skills you want to evaluate.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-950 rounded-lg text-sm font-bold hover:bg-teal-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Competency
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {competencies.map((comp: Competency) => (
          <div key={comp.id} className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-5 group hover:border-teal-500/30 transition-all">
            <h4 className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors">{comp.title}</h4>
            <p className="text-xs text-slate-500 leading-relaxed mt-2">{comp.description}</p>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/50">
               <span className="text-[8px] font-bold uppercase tracking-widest text-slate-600">Weight {comp.weight}/5</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateManager({ templates, setTemplates }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Scoring Rubrics</h2>
      <div className="grid grid-cols-1 gap-4">
        {templates.map((temp: ScoringTemplate) => (
          <div key={temp.id} className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-6 group hover:border-teal-500/30 transition-all">
            <h4 className="font-bold text-slate-200 group-hover:text-teal-400 transition-colors mb-4">{temp.title}</h4>
            <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono bg-slate-950/30 p-4 rounded-lg border border-slate-800/50">
              {temp.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateManager({ candidates, setCandidates }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [newSample, setNewSample] = useState({ type: 'text' as any, content: '' });

  const addCandidate = () => {
    if (!newName) return;
    const candidate = { id: Date.now().toString(), name: newName, workSamples: [] };
    setCandidates(candidate);
    setNewName('');
    setIsAdding(false);
    setSelectedCandidate(candidate);
  };

  const addSample = () => {
    if (!selectedCandidate || !newSample.content) return;
    const updated = {
      ...selectedCandidate,
      workSamples: [...selectedCandidate.workSamples, { ...newSample, id: Date.now().toString(), timestamp: new Date().toISOString() }]
    };
    // In a real implementation this would call updateCand to Firebase
    setSelectedCandidate(updated);
    setNewSample({ type: 'text', content: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Candidates</h2>
          <p className="text-slate-400 text-sm">Manage candidates and their work samples.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="btn-primary">Add Candidate</button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-3">
          {candidates.map((c: Candidate) => (
            <button
               key={c.id}
               onClick={() => setSelectedCandidate(c)}
               className={cn(
                 "w-full text-left p-4 rounded-xl border transition-all",
                 selectedCandidate?.id === c.id ? "bg-teal-500/10 border-teal-500/30 text-teal-400" : "bg-slate-950/40 border-slate-800/50 text-slate-400"
               )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
           {selectedCandidate ? (
             <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-6">{selectedCandidate.name}</h3>
                <div className="space-y-4">
                  <textarea 
                    value={newSample.content}
                    onChange={e => setNewSample({...newSample, content: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm"
                    placeholder="Paste work sample..."
                  />
                  <button onClick={addSample} className="btn-primary">Add Work Sample</button>
                </div>
             </div>
           ) : (
             <div className="p-12 text-center text-slate-600 border border-dashed border-slate-800 rounded-xl">
                Select a candidate to view details
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

function buildEvaluationPrompt(candidate: any, competencies: any[], templates: any[]) {
  const compText = competencies.map(c => {
    const t = templates.find((tmp: any) => tmp.id === `t${c.id.slice(1)}`) || { content: 'No specific rubric found.' };
    return `ID: ${c.id}\nTitle: ${c.title} (Weight: ${c.weight}/5)\nDescription: ${c.description}\nRubric:\n${t.content}\n---`;
  }).join('\n\n');

  const workText = candidate.workSamples.map((s: any, idx: number) => 
    `Sample ${idx+1} [Type: ${s.type}, Date: ${new Date(s.timestamp).toLocaleDateString()}]:\n"""\n${s.content.slice(0, 2000)}\n"""`
  ).join('\n\n');

  return `You are an expert HR evaluator acting as the Axiometric Rubric Scoring Agent.

CANDIDATE: ${candidate.name}

COMPETENCIES TO EVALUATE:
${compText}

CANDIDATE WORK SAMPLES:
${workText}

INSTRUCTIONS:
1. Score each competency 1-10 based ONLY on evidence from the provided work samples.
2. If a competency has no relevant evidence, score it 1 and set confidence to "Low".
3. Justify every score with specific quotes or references from the work samples.
4. Extract behavioral patterns, overall strengths, and weaknesses.
5. Return ONLY valid JSON block matching this exact structure, with no markdown formatting outside of the block:

{
  "overallScore": number (1-10),
  "confidenceLevel": "High" | "Medium" | "Low",
  "competencyBreakdown": [
    {
      "competencyId": string,
      "name": string,
      "score": number (1-10),
      "confidence": "High" | "Medium" | "Low",
      "justification": string,
      "evidence": [string, string]
    }
  ],
  "patterns": {
    "strengths": [string],
    "weaknesses": [string],
    "behavioralPatterns": [string]
  },
  "recommendations": [string]
}`;
}

function parseEvaluationResponse(text: string, candidateId: string): EvaluationResult {
  let cleaned = text.trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    cleaned = match[0];
  }
  
  try {
    const parsed = JSON.parse(cleaned);
    return {
      candidateId,
      overallScore: parsed.overallScore || 0,
      confidenceLevel: parsed.confidenceLevel || 'Low',
      competencyBreakdown: parsed.competencyBreakdown || [],
      patterns: parsed.patterns || { strengths: [], weaknesses: [], behavioralPatterns: [] },
      recommendations: parsed.recommendations || [],
      timestamp: new Date().toISOString()
    };
  } catch (e: any) {
    throw new Error("Failed to parse AI evaluation data. Response was not properly formatted.");
  }
}

function EvaluationEngine({ candidates, competencies, templates, evaluations, setEvaluations }: any) {
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentResult, setCurrentResult] = useState<EvaluationResult | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const runEvaluation = async () => {
    if (!selectedCandidateId) { alert("Select a candidate."); return; }
    const candidate = candidates.find((c: any) => c.id === selectedCandidateId);
    if (!candidate?.workSamples?.length) { alert("This candidate has no work samples to evaluate."); return; }
    
    setIsEvaluating(true);
    setCurrentResult(null);

    try {
      const systemPrompt = buildEvaluationPrompt(candidate, competencies, templates);
      const result = await window.electronAPI.chatRelay({
        model: 'google/gemini-2.0-flash-001',
        systemPrompt: systemPrompt,
        messages: [{ role: 'user', content: 'Evaluate this candidate now based on your instructions. Return ONLY the JSON object.' }]
      });

      if (result.error) throw new Error(result.error);
      if (!result.text) throw new Error("No text returned from API.");

      const parsed = parseEvaluationResponse(result.text, selectedCandidateId);
      setCurrentResult(parsed);
      setEvaluations(parsed);
    } catch (err: any) {
      alert(`Evaluation Error: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const chartData = currentResult?.competencyBreakdown.map(s => ({
    subject: s.name,
    A: s.score,
    fullMark: 10,
  })) || [];

  return (
    <div className="space-y-8" ref={reportRef}>
      <div className="flex justify-between items-center bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50">
        <div className="flex-1 max-w-sm">
           <select 
              value={selectedCandidateId}
              onChange={e => setSelectedCandidateId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200"
            >
              <option value="">Select Candidate...</option>
              {candidates.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
        </div>
        <button 
          onClick={runEvaluation} 
          disabled={isEvaluating}
          className="btn-primary"
        >
          {isEvaluating ? "Analyzing..." : "Run Evaluation"}
        </button>
      </div>

      {currentResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-slate-950/40 p-6 rounded-2xl border border-slate-800/50 h-[400px]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Performance Matrix</h3>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 8 }} />
                  <Radar dataKey="A" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
           </div>
           <div className="space-y-4 overflow-y-auto max-h-[400px] custom-scrollbar pr-4">
              {currentResult.competencyBreakdown.map((item, idx) => (
                <CompetencyScoreItem key={idx} item={item} />
              ))}
           </div>
        </div>
      )}
    </div>
  );
}

function ComparisonView({ candidates, evaluations, competencies }: any) {
  const chartData = useMemo(() => {
    if (!evaluations || evaluations.length === 0) return [];
    
    // Group evaluations by candidate to prevent duplicate rows if evaluated multiple times
    const latestEvals = new Map();
    evaluations.forEach((ev: any) => {
      // Assuming evaluationsDb is roughly chronological, later array items override earlier ones
      latestEvals.set(ev.candidateId, ev);
    });

    return Array.from(latestEvals.values()).map((ev: any) => {
      const cand = candidates.find((c: any) => c.id === ev.candidateId);
      const dataPoint: any = { 
        name: cand ? cand.name : 'Unknown',
        overallScore: ev.overallScore 
      };
      
      ev.competencyBreakdown?.forEach((comp: any) => {
        dataPoint[comp.name] = comp.score;
      });
      
      return dataPoint;
    }).sort((a: any, b: any) => b.overallScore - a.overallScore);
  }, [evaluations, candidates]);

  if (chartData.length === 0) {
    return (
       <div className="p-12 mt-12 text-center text-slate-600 border border-dashed border-slate-800 rounded-xl">
         No evaluations run yet. Run evaluations to see candidate comparisons.
       </div>
    );
  }

  const PIE_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#f43f5e'];

  return (
    <div className="space-y-6">
      <div className="bg-slate-950/40 p-6 rounded-2xl border border-slate-800/50">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Candidate Scores</h3>
        <div style={{ height: 450, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 12}} angle={-45} textAnchor="end" />
              <YAxis domain={[0, 10]} tick={{fill: '#94a3b8', fontSize: 12}} />
              <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: 8, color: '#fff'}} itemStyle={{color: '#fff'}} />
              <Bar dataKey="overallScore" fill="#facc15" name="Overall Score" radius={[4, 4, 0, 0]} />
              {competencies.slice(0, 5).map((comp: any, idx: number) => (
                 <Bar key={comp.id} dataKey={comp.title} fill={PIE_COLORS[idx % PIE_COLORS.length]} name={comp.title} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ onResetData }: any) {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-slate-950/40 p-8 rounded-2xl border border-slate-800/50">
          <h3 className="text-sm font-bold uppercase tracking-widest text-teal-400 mb-6">Environment Details</h3>
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              The Artificial Intelligence evaluating candidates is automatically powered by the global Axiometric Core backend.
              <br /><br />
              All computations are routed securely through <strong>Google Gemini 2.0 Flash</strong> utilizing your isolated desktop IPC channel. No further authentication configuration is required here.
            </p>
          </div>
      </div>
      <div className="bg-slate-950/40 p-8 rounded-2xl border border-slate-800/50">
          <h3 className="text-sm font-bold uppercase tracking-widest text-red-500 mb-6">Danger Zone</h3>
          <button onClick={() => { if(window.confirm('Are you sure you want to clear all evaluation data?')) onResetData(); }} className="btn-danger w-full py-3">
             Clear All Evaluations History
          </button>
      </div>
    </div>
  );
}
