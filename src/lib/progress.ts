import type { ProgressState } from "./types";

export const DEFAULT_PROGRESS: ProgressState = {
  answers: {},
  wrong: {},
  favorites: {},
  mockRuns: []
};

const LEGACY_KEYS: Record<string, string[]> = {
  "route-switching": ["network-practice-v1"],
  "network-security": ["netsec_practice_v1"],
  "data-collection": ["crawler_practice_v1"],
  "data-visualization": ["data_visualization_practice_state_v1"],
  "data-structure": ["dsPracticeState"],
  "linux-course": ["linux_practice_state_v1"],
  "modern-history": ["modern_history_practice_state_v2"],
  community: ["community_practice_state_v1"],
  "higher-math-down": ["higher_math_down_practice_state_v1"]
};

function emptyProgress(): ProgressState {
  return structuredClone(DEFAULT_PROGRESS);
}

export function progressKey(subjectId: string): string {
  return `studyhub:v2:${subjectId}`;
}

export function legacyKeysFor(subjectId: string): string[] {
  return LEGACY_KEYS[subjectId] || [];
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  return parseJson(localStorage.getItem(key));
}

function toRecord(value: unknown): Record<string, true> {
  const out: Record<string, true> = {};
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item) out[String(item)] = true;
    });
    return out;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val !== false && val !== null && val !== undefined) out[key] = true;
    });
  }
  return out;
}

function normalizeProgress(value: unknown): ProgressState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ProgressState>;
  return {
    ...DEFAULT_PROGRESS,
    ...raw,
    answers: raw.answers && typeof raw.answers === "object" ? raw.answers : {},
    wrong: toRecord(raw.wrong),
    favorites: toRecord(raw.favorites),
    mockRuns: Array.isArray(raw.mockRuns) ? raw.mockRuns : []
  };
}

function applyLegacyState(
  migrated: ProgressState,
  key: string,
  raw: Record<string, unknown>,
  migratedFrom: string[]
) {
  migratedFrom.push(key);
  if (raw.answers && typeof raw.answers === "object") {
    Object.assign(migrated.answers, raw.answers);
  }
  Object.assign(migrated.wrong, toRecord(raw.wrong));
  Object.assign(migrated.favorites, toRecord(raw.favorites || raw.favorite || raw.marked || raw.mastered));
  Object.assign(migrated.answers, raw.done && typeof raw.done === "object" ? raw.done : {});
  if (raw.exam && typeof raw.exam === "object") {
    migrated.mockRuns.push({
      id: `legacy-${key}`,
      title: "旧版模拟考试记录",
      questionIds: [],
      score: 0,
      totalScore: 0,
      submittedAt: new Date().toISOString()
    });
  }
}

function migrateLegacyState(subjectId: string): ProgressState {
  const migrated = emptyProgress();
  const migratedFrom: string[] = [];
  for (const key of legacyKeysFor(subjectId)) {
    const raw = readJson(key) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") continue;
    applyLegacyState(migrated, key, raw, migratedFrom);
  }
  if (migratedFrom.length) migrated.migratedFrom = migratedFrom;
  return migrated;
}

export function migrateSnapshotProgress(subjectId: string, snapshot: Record<string, string>): ProgressState | null {
  const current = normalizeProgress(parseJson(snapshot[progressKey(subjectId)]));
  if (current) return current;

  const migrated = emptyProgress();
  const migratedFrom: string[] = [];
  for (const key of legacyKeysFor(subjectId)) {
    const raw = parseJson(snapshot[key]) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") continue;
    applyLegacyState(migrated, key, raw, migratedFrom);
  }
  if (!migratedFrom.length) return null;
  migrated.migratedFrom = migratedFrom;
  migrated.updatedAt = new Date().toISOString();
  return migrated;
}

export function loadLocalProgress(subjectId: string): ProgressState {
  const key = progressKey(subjectId);
  const current = normalizeProgress(readJson(key));
  if (current) return current;

  const migrated = migrateLegacyState(subjectId);
  migrated.updatedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(migrated));
  return migrated;
}

export function saveLocalProgress(subjectId: string, state: ProgressState): void {
  const next = { ...state, updatedAt: new Date().toISOString() };
  localStorage.setItem(progressKey(subjectId), JSON.stringify(next));
}

function canUseSessionApi(): boolean {
  if (!["http:", "https:"].includes(location.protocol)) return false;
  const host = location.hostname.toLowerCase();
  return !(host.endsWith(".github.io") || host === "me.mai-xiyu.top");
}

function ensureClientId(): string {
  const key = "study_hub_client_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export async function loadRemoteSnapshot(app: string): Promise<Record<string, string> | null> {
  if (!canUseSessionApi()) return null;
  const client = ensureClientId();
  try {
    const response = await fetch(`/api/session?app=${encodeURIComponent(app)}&client=${encodeURIComponent(client)}`, {
      credentials: "same-origin",
      headers: { "X-Study-Client": client }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.app?.localStorage && typeof data.app.localStorage === "object" ? data.app.localStorage : null;
  } catch {
    return null;
  }
}

export async function saveRemoteSnapshot(app: string): Promise<void> {
  if (!canUseSessionApi()) return;
  const client = ensureClientId();
  const localStorageSnapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key) localStorageSnapshot[key] = localStorage.getItem(key) || "";
  }
  await fetch(`/api/session?app=${encodeURIComponent(app)}&client=${encodeURIComponent(client)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Study-Client": client },
    body: JSON.stringify({
      app,
      localStorage: localStorageSnapshot,
      meta: { title: document.title, path: location.pathname, clientId: client, savedAt: new Date().toISOString() }
    })
  }).catch(() => undefined);
}
