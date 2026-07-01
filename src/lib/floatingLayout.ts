export interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingPanelState {
  rect: FloatingRect;
  opacity: number;
  hidden: boolean;
  collapsed: boolean;
  zIndex: number;
}

export interface FloatingLayoutState {
  enabled: boolean;
  panels: Record<string, FloatingPanelState>;
  updatedAt?: string;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface FloatingPanelConfig {
  id: string;
  defaultRect: FloatingRect;
  minWidth?: number;
  minHeight?: number;
  priority?: number;
}

const OPACITY_STEPS = [1, 0.85, 0.65, 0.45];
const DEFAULT_MIN_WIDTH = 180;
const DEFAULT_MIN_HEIGHT = 96;
const EDGE_GAP = 12;
const GRID_GAP = 16;
const DOCK_WIDTH = 220;
const PRIMARY_PANEL_ID = "question";
const CONTENT_MAX_WIDTH = 1180;
const DESKTOP_NAV_HEIGHT = 132;
const PANEL_GAP = 16;

export function floatingLayoutKey(subjectId: string): string {
  return `studyhub:layout:v2:${subjectId}`;
}

export function emptyFloatingLayout(): FloatingLayoutState {
  return { enabled: false, panels: {} };
}

export function nextOpacity(current: number): number {
  const index = OPACITY_STEPS.findIndex((value) => Math.abs(value - current) < 0.01);
  return OPACITY_STEPS[(index + 1) % OPACITY_STEPS.length] || OPACITY_STEPS[0];
}

export function normalizeFloatingLayout(value: unknown): FloatingLayoutState {
  if (!value || typeof value !== "object") return emptyFloatingLayout();
  const raw = value as Partial<FloatingLayoutState>;
  const panels: Record<string, FloatingPanelState> = {};
  if (raw.panels && typeof raw.panels === "object") {
    Object.entries(raw.panels).forEach(([id, panel]) => {
      if (!panel || typeof panel !== "object") return;
      const item = panel as Partial<FloatingPanelState>;
      const rect = item.rect || {};
      panels[id] = {
        rect: {
          x: Number((rect as Partial<FloatingRect>).x || 0),
          y: Number((rect as Partial<FloatingRect>).y || 0),
          width: Number((rect as Partial<FloatingRect>).width || DOCK_WIDTH),
          height: Number((rect as Partial<FloatingRect>).height || DEFAULT_MIN_HEIGHT)
        },
        opacity: typeof item.opacity === "number" && item.opacity >= 0.4 && item.opacity <= 1 ? item.opacity : 1,
        hidden: Boolean(item.hidden),
        collapsed: Boolean(item.collapsed),
        zIndex: Number(item.zIndex || 1)
      };
    });
  }
  return {
    enabled: Boolean(raw.enabled),
    panels,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}

export function loadFloatingLayout(subjectId: string): FloatingLayoutState {
  try {
    const raw = localStorage.getItem(floatingLayoutKey(subjectId));
    return normalizeFloatingLayout(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyFloatingLayout();
  }
}

export function saveFloatingLayout(subjectId: string, state: FloatingLayoutState): void {
  localStorage.setItem(floatingLayoutKey(subjectId), JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}

export function clampRect(rect: FloatingRect, viewport: ViewportSize, minWidth = DEFAULT_MIN_WIDTH, minHeight = DEFAULT_MIN_HEIGHT): FloatingRect {
  const width = Math.min(Math.max(rect.width, minWidth), Math.max(minWidth, viewport.width - EDGE_GAP * 2));
  const height = Math.min(Math.max(rect.height, minHeight), Math.max(minHeight, viewport.height - EDGE_GAP * 2));
  const x = Math.min(Math.max(rect.x, EDGE_GAP), Math.max(EDGE_GAP, viewport.width - width - EDGE_GAP));
  const y = Math.min(Math.max(rect.y, EDGE_GAP), Math.max(EDGE_GAP, viewport.height - height - EDGE_GAP));
  return { x, y, width, height };
}

function overlaps(a: FloatingRect, b: FloatingRect): boolean {
  return a.x < b.x + b.width + GRID_GAP &&
    a.x + a.width + GRID_GAP > b.x &&
    a.y < b.y + b.height + GRID_GAP &&
    a.y + a.height + GRID_GAP > b.y;
}

export function avoidOverlap(rect: FloatingRect, others: FloatingRect[], viewport: ViewportSize, minWidth = DEFAULT_MIN_WIDTH, minHeight = DEFAULT_MIN_HEIGHT): FloatingRect {
  let next = clampRect(rect, viewport, minWidth, minHeight);
  for (let attempts = 0; attempts < 80; attempts += 1) {
    if (!others.some((other) => overlaps(next, other))) return next;
    next = clampRect({ ...next, y: next.y + GRID_GAP }, viewport, minWidth, minHeight);
    if (next.y + next.height + EDGE_GAP >= viewport.height) {
      next = clampRect({ ...next, x: next.x - GRID_GAP, y: EDGE_GAP }, viewport, minWidth, minHeight);
    }
  }
  return next;
}

export function ensurePanelState(config: FloatingPanelConfig, state?: FloatingPanelState): FloatingPanelState {
  return {
    rect: state?.rect || config.defaultRect,
    opacity: state?.opacity ?? 1,
    hidden: state?.hidden ?? false,
    collapsed: state?.collapsed ?? false,
    zIndex: state?.zIndex ?? 1
  };
}

export function rightDockArrange(
  configs: FloatingPanelConfig[],
  state: FloatingLayoutState,
  viewport: ViewportSize
): Record<string, FloatingPanelState> {
  const next: Record<string, FloatingPanelState> = {};
  const primary = configs.find((config) => config.id === PRIMARY_PANEL_ID);
  const visibleWidth = Math.max(720, viewport.width - EDGE_GAP * 2);
  const contentWidth = Math.min(CONTENT_MAX_WIDTH, visibleWidth);
  const contentLeft = Math.max(EDGE_GAP, Math.round((viewport.width - contentWidth) / 2));
  const sidebarWidth = viewport.width >= 1180 ? 270 : 230;
  const mainWidth = Math.max(520, contentWidth - sidebarWidth - PANEL_GAP);
  const sidebarX = contentLeft + mainWidth + PANEL_GAP;
  const topY = Math.max(DESKTOP_NAV_HEIGHT + 18, EDGE_GAP);

  function applyPanel(config: FloatingPanelConfig, rect: FloatingRect) {
    const current = ensurePanelState(config, state.panels[config.id]);
    if (current.hidden) {
      next[config.id] = current;
      return;
    }
    next[config.id] = {
      ...current,
      rect: clampRect(rect, viewport, config.minWidth, config.minHeight)
    };
  }

  function configById(id: string) {
    return configs.find((config) => config.id === id);
  }

  function placeGrid(ids: string[], y: number, preferredWidth: number, height: number, minWidth: number) {
    const columns = Math.max(1, Math.floor((mainWidth + PANEL_GAP) / (minWidth + PANEL_GAP)));
    const width = Math.max(minWidth, Math.floor((mainWidth - PANEL_GAP * (columns - 1)) / columns));
    ids.forEach((id, index) => {
      const config = configById(id);
      if (!config) return;
      const column = index % columns;
      const row = Math.floor(index / columns);
      applyPanel(config, {
        x: contentLeft + column * (width + PANEL_GAP),
        y: y + row * (height + PANEL_GAP),
        width: Math.min(preferredWidth, width),
        height
      });
    });
    return y + Math.ceil(ids.filter((id) => Boolean(configById(id))).length / columns) * (height + PANEL_GAP);
  }

  const subject = configById("subject");
  if (subject) {
    applyPanel(subject, { x: contentLeft, y: topY, width: mainWidth, height: 120 });
  }

  const statIds = ["stat-total", "stat-done", "stat-wrong", "stat-accuracy", "stat-bank"];
  const statTop = topY + 136;
  const afterStats = placeGrid(statIds, statTop, 220, 100, 148);

  const modeTabs = configById("mode-tabs");
  const modeTop = afterStats;
  if (modeTabs) {
    applyPanel(modeTabs, { x: contentLeft, y: modeTop, width: mainWidth, height: 96 });
  }

  const filterIds = ["filter-chapter", "filter-type", "filter-source", "filter-search"];
  const filtersTop = modeTop + (modeTabs ? 112 : 0);
  const afterFilters = placeGrid(filterIds, filtersTop, 360, 96, 210);

  if (primary) {
    const questionTop = afterFilters + 4;
    const questionHeight = Math.max(260, Math.min(620, viewport.height - questionTop - EDGE_GAP));
    applyPanel(primary, { x: contentLeft, y: questionTop, width: mainWidth, height: questionHeight });
  }

  const mockStrip = configById("mock-strip");
  if (mockStrip) {
    applyPanel(mockStrip, { x: sidebarX, y: topY, width: sidebarWidth, height: 120 });
  }

  let sidebarY = topY;

  const metricIds = ["answer-done", "answer-correct", "answer-wrong", "answer-marked", "answer-review"];
  const metricWidth = Math.floor((sidebarWidth - PANEL_GAP) / 2);
  let metricIndex = 0;
  metricIds.forEach((id) => {
    const config = configById(id);
    if (!config) return;
    const current = ensurePanelState(config, state.panels[config.id]);
    if (current.hidden) {
      next[config.id] = current;
      return;
    }
    const column = metricIndex % 2;
    const row = Math.floor(metricIndex / 2);
    applyPanel(config, {
      x: sidebarX + column * (metricWidth + PANEL_GAP),
      y: topY + row * (100 + PANEL_GAP),
      width: metricWidth,
      height: 100
    });
    metricIndex += 1;
  });
  if (metricIndex > 0) {
    sidebarY = topY + Math.ceil(metricIndex / 2) * (100 + PANEL_GAP);
  }

  ["answer-nearby", "answer-full", "answer-legend"].forEach((id) => {
    const config = configById(id);
    if (!config) return;
    const current = ensurePanelState(config, state.panels[config.id]);
    if (current.hidden) {
      next[config.id] = current;
      return;
    }
    const minHeight = current.collapsed ? 44 : config.minHeight || DEFAULT_MIN_HEIGHT;
    const height = Math.max(minHeight, current.collapsed ? 44 : config.defaultRect.height);
    const availableHeight = Math.max(minHeight, viewport.height - sidebarY - EDGE_GAP);
    const rect = clampRect({ x: sidebarX, y: sidebarY, width: sidebarWidth, height: Math.min(height, availableHeight) }, viewport, config.minWidth, minHeight);
    next[config.id] = { ...current, rect };
    sidebarY = rect.y + rect.height + GRID_GAP;
  });

  const sidebarConfigs = configs
    .filter((config) => !next[config.id] && (config.id.startsWith("answer-") || config.id === "answer" || (config.id === "mock-strip" && !next[config.id])))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  sidebarConfigs.forEach((config) => {
    const current = ensurePanelState(config, state.panels[config.id]);
    if (current.hidden) {
      next[config.id] = current;
      return;
    }

    const width = Math.max(config.minWidth || DEFAULT_MIN_WIDTH, Math.min(sidebarWidth, config.defaultRect.width));
    const height = Math.max(config.minHeight || DEFAULT_MIN_HEIGHT, current.collapsed ? 44 : config.defaultRect.height);
    const minHeight = current.collapsed ? 44 : config.minHeight || DEFAULT_MIN_HEIGHT;
    const availableHeight = Math.max(minHeight, viewport.height - sidebarY - EDGE_GAP);
    const arrangedHeight = Math.min(height, availableHeight);
    const rect = clampRect({ x: sidebarX, y: sidebarY, width, height: arrangedHeight }, viewport, config.minWidth, minHeight);
    next[config.id] = { ...current, rect };
    sidebarY = rect.y + rect.height + GRID_GAP;

    if (sidebarY + minHeight + EDGE_GAP > viewport.height) {
      sidebarY = topY;
    }
  });

  configs.forEach((config) => {
    if (next[config.id]) return;
    const current = ensurePanelState(config, state.panels[config.id]);
    next[config.id] = {
      ...current,
      rect: clampRect(current.rect || config.defaultRect, viewport, config.minWidth, config.minHeight)
    };
  });

  return next;
}

export function focusQuestionArrange(
  configs: FloatingPanelConfig[],
  state: FloatingLayoutState,
  viewport: ViewportSize
): Record<string, FloatingPanelState> {
  const next: Record<string, FloatingPanelState> = {};
  const configuredIds = new Set(configs.map((config) => config.id));
  const primary = configs.find((config) => config.id === PRIMARY_PANEL_ID);
  const topY = Math.max(DESKTOP_NAV_HEIGHT + 96, Math.round(viewport.height * 0.28), EDGE_GAP);

  if (primary) {
    const current = ensurePanelState(primary, state.panels[primary.id]);
    const width = Math.min(920, Math.max(primary.minWidth || 520, Math.round(viewport.width * 0.46)));
    const height = Math.min(520, Math.max(primary.minHeight || 300, Math.round(viewport.height * 0.45)));
    next[primary.id] = {
      ...current,
      hidden: false,
      collapsed: false,
      rect: clampRect({
        x: Math.round((viewport.width - width) / 2),
        y: topY,
        width,
        height
      }, viewport, primary.minWidth, primary.minHeight)
    };
  }

  configs.forEach((config) => {
    if (config.id === PRIMARY_PANEL_ID) return;
    const current = ensurePanelState(config, state.panels[config.id]);
    next[config.id] = {
      ...current,
      hidden: true,
      collapsed: false,
      rect: clampRect(current.rect || config.defaultRect, viewport, config.minWidth, config.minHeight)
    };
  });

  Object.entries(state.panels).forEach(([id, current]) => {
    if (id === PRIMARY_PANEL_ID || configuredIds.has(id)) return;
    next[id] = {
      ...current,
      hidden: true,
      collapsed: false,
      rect: clampRect(current.rect, viewport)
    };
  });

  return next;
}
