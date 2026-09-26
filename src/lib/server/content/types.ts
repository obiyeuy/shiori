export const contentTypes = ['article', 'note', 'moment', 'project', 'tool', 'resource'] as const;
export type ContentType = (typeof contentTypes)[number];

export type DraftInput = {
  type: ContentType;
  title?: string;
  body?: string;
  slug?: string;
  summary?: string;
  cover?: string;
  tags?: string[];
  commentsEnabled?: boolean;
  gallery?: string[];
  related?: string[];
  demoUrl?: string;
  codeUrl?: string;
  author?: string;
  description?: string;
  projectStatus?: 'in-progress' | 'completed' | 'paused' | 'stopped';
  unavailableReason?: string;
  sourceName?: string;
  sourceUrl?: string;
  toolStatus?: 'available' | 'maintenance' | 'unavailable' | 'retired';
  toolUrl?: string;
};

export type ValidationError = { field: string; message: string };
export type DraftValidationResult = { ok: true; errors: [] } | { ok: false; errors: ValidationError[] };

export type Conflict = {
  kind: 'conflict';
  localRevision: number;
  serverRevision: number;
  serverDraft: unknown;
};

export type PublicVersion = {
  id: string;
  contentId: string;
  type: ContentType;
  slug: string;
  title: string;
  body: string;
  publishedAt: Date;
};

export type OperationalState = 'unconfigured' | 'no-record' | 'running' | 'success' | 'failure' | 'stale' | 'read-failure' | 'unknown';
export type OperationalStatus = {
  state: OperationalState;
  eventAt: Date | null;
  collectedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  detail: string | null;
};
