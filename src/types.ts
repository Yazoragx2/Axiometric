export interface Competency {
  id: number;
  name: string;
}

export interface Domain {
  name: string;
  competencies: Competency[];
}

export interface CompetencyStatus {
  id?: string;
  compId: number;
  compDoc: string;
  scoringTemplate: string;
  notes: string;
}

export interface Document {
  id: string;
  name: string;
  category: string;
  version: string;
  url: string;
  status: string;
  notes: string;
  dateAdded: string;
}

export interface QueueItem {
  id: string;
  docName: string;
  action: string;
  priority: string;
  status: string;
  dateSubmitted: string;
  notes: string;
  feedbackNotes: string;
}

export interface Session {
  id: string;
  date: string;
  label: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export interface TimerState {
  running: boolean;
  startTimestamp: number | null;
  label: string;
  elapsedAtStop: number;
}

export interface CustomCompetency {
  id: number;
  name: string;
  domain: string;
}

// --- Team & RBAC Types ---

export type UserRole = 'owner' | 'admin' | 'member';

export interface FeaturePermissions {
  view: boolean;
  edit: boolean;
  admin?: boolean;
  upload?: boolean;
}

export interface RolePermissions {
  hoursAndPay: FeaturePermissions;
  masterplan: FeaturePermissions;
  documentStore: FeaturePermissions;
  competencyTracker: FeaturePermissions;
  bossQueue: FeaturePermissions;
}

export interface TeamMember {
  uid: string;
  email: string;
  nickname: string;
  role: UserRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  members: Record<string, TeamMember>; // UID -> Member details
  permissionsConfig: Record<UserRole, RolePermissions>;
}

export const OWNER_EMAIL = 'felixvenue99@gmail.com';

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    hoursAndPay: { view: true, edit: true, admin: true },
    masterplan: { view: true, edit: true },
    documentStore: { view: true, edit: true, upload: true },
    competencyTracker: { view: true, edit: true },
    bossQueue: { view: true, edit: true }
  },
  admin: {
    hoursAndPay: { view: true, edit: true, admin: true },
    masterplan: { view: true, edit: true },
    documentStore: { view: true, edit: true, upload: true },
    competencyTracker: { view: true, edit: true },
    bossQueue: { view: true, edit: true }
  },
  member: {
    hoursAndPay: { view: true, edit: true, admin: false },
    masterplan: { view: true, edit: false },
    documentStore: { view: true, edit: true, upload: true },
    competencyTracker: { view: true, edit: false },
    bossQueue: { view: true, edit: false }
  }
};

// --- Electron IPC Types ---

declare global {
  interface Window {
    electronAPI: {
      chatRelay: (payload: { model: string, systemPrompt: string, messages: any[] }) => Promise<{ text?: string, error?: string }>;
      getModels: () => Promise<Array<{ id: string, name: string }>>;
    }
  }
}
