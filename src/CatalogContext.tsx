import React, { createContext, useContext, useMemo } from 'react';
import { Domain, Competency, CustomCompetency } from './types';
import { BASE_DOMAINS } from './constants';
import { useFirestore } from './hooks/useFirestore';

interface CatalogContextType {
  domains: Domain[];
  allCompetencies: Competency[];
  domainForComp: Record<number, string>;
  totalCompetencies: number;
  customCatalog: CustomCompetency[];
  addCustomCompetency: (item: Omit<CustomCompetency, 'id'>) => Promise<void>;
}

const CatalogContext = createContext<CatalogContextType | null>(null);

function normalizeDomainName(name: string) {
  return (name || '').trim();
}

function normalizeCompetencyName(name: string) {
  return (name || '').trim();
}

function mergeDomains(baseDomains: Domain[], customCompetencies: CustomCompetency[]): Domain[] {
  const domains = baseDomains.map(d => ({
    name: d.name,
    competencies: d.competencies.map(c => ({ id: c.id, name: c.name })),
  }));

  const byName: Record<string, Domain> = {};
  domains.forEach(d => { byName[d.name] = d; });

  (customCompetencies || []).forEach(c => {
    const domainName = normalizeDomainName(c.domain) || 'Custom';
    const compName = normalizeCompetencyName(c.name);
    const compId = Number(c.id);
    if (!compName || !Number.isFinite(compId)) return;

    if (!byName[domainName]) {
      byName[domainName] = { name: domainName, competencies: [] };
      domains.push(byName[domainName]);
    }
    if (byName[domainName].competencies.some(x => x.id === compId)) return;
    byName[domainName].competencies.push({ id: compId, name: compName });
  });

  domains.forEach(d => d.competencies.sort((a,b) => a.id - b.id));
  return domains;
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { data: customCatalog, addItem } = useFirestore<CustomCompetency>('customCatalog');

  const domains = useMemo(() => mergeDomains(BASE_DOMAINS, customCatalog), [customCatalog]);
  const allCompetencies = useMemo(() => domains.flatMap(d => d.competencies), [domains]);
  const domainForComp = useMemo(() => {
    const map: Record<number, string> = {};
    domains.forEach(d => d.competencies.forEach(c => { map[c.id] = d.name; }));
    return map;
  }, [domains]);

  const totalCompetencies = allCompetencies.length;

  const addCustomCompetency = async (item: Omit<CustomCompetency, 'id'>) => {
    const maxId = allCompetencies.reduce((m, c) => Math.max(m, Number(c.id) || 0), 0);
    const nextId = maxId + 1;
    await addItem({ ...item, id: nextId });
  };

  const value = useMemo(() => ({
    domains,
    allCompetencies,
    domainForComp,
    totalCompetencies,
    customCatalog,
    addCustomCompetency,
  }), [domains, allCompetencies, domainForComp, totalCompetencies, customCatalog]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
