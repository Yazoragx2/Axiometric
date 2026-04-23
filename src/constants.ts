import { Domain } from './types';

export const TIMER_KEY = 'va_timer';
export const SESSION_CONTEXT_KEY = 'va_session_context';
export const AI_CHAT_HISTORY_KEY = 'va_ai_chat_history_v1';
export const COMPETENCY_CATALOG_KEY = 'va_custom_competency_catalog';

export const BASE_DOMAINS: Domain[] = [];

export const STATUS_OPTIONS = ["Not Started","In Progress","Pending Boss’s Queue Review","Approved","Boss’s Queue Feedback  -  Revisions Needed"];
export const DOC_STATUSES = ["Draft","Pending Boss’s Queue Review","Approved","Superseded"];
export const DOC_CATEGORIES = ["Foundation Templates","Competency Documents","Scoring Templates","Phase Documents","Research Documents","Update Logs","Other"];
export const SESSION_TYPES = ["Competency Build","Admin/Documentation","Research Only","Boss’s Queue Feedback Actioning","Other"];
export const PRIORITY_OPTIONS = ["High","Medium","Low"];
export const QUEUE_STATUSES = ["Waiting","In Progress","Boss’s Queue Responded","Complete","On Hold"];

export const ADJACENT_MAP: Record<number, string> = {};
