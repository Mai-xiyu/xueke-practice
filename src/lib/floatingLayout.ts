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
const TOP_DOCK_Y = 150;

export function floatingLayoutKey(subjectId: string): string {
  return `studyhub:layout:v1:${subjectId}`;
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
  const sorted = configs
    .filter((config) => config.id !== PRIMARY_PANEL_ID)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const dockColumns = viewport.width >= 1280 ? 3 : 2;
  const dockAreaWidth = DOCK_WIDTH * dockColumns + GRID_GAP * (dockColumns - 1);
  const desiredPrimaryWidth = Math.min(
    760,
    Math.max(420, viewport.width - dockAreaWidth - GRID_GAP * 2 - EDGE_GAP * 2)
  );
  let primaryRight = EDGE_GAP;

  if (primary) {
    const current = ensurePanelState(primary, state.panels[primary.id]);
    if (current.hidden) {
      next[primary.id] = current;
    } else {
      const width = desiredPrimaryWidth;
      next[primary.id] = {
        ...current,
        rect: clampRect({ x: EDGE_GAP, y: 220, width, height: Math.min(560, viewport.height - 260) }, viewport, 420, 220)
      };
      primaryRight = next[primary.id].rect.x + next[primary.id].rect.width;
    }
  }

  const minDockX = Math.min(viewport.width - DOCK_WIDTH - EDGE_GAP, primaryRight + GRID_GAP);
  const columns: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < dockColumns; index += 1) {
    const x = viewport.width - EDGE_GAP - DOCK_WIDTH - index * (DOCK_WIDTH + GRID_GAP);
    if (x >= minDockX || !columns.length) {
      columns.push({ x, y: Math.max(TOP_DOCK_Y, EDGE_GAP) });
    }
  }
  if (!columns.length) {
    columns.push({ x: Math.max(EDGE_GAP, viewport.width - DOCK_WIDTH - EDGE_GAP), y: Math.max(TOP_DOCK_Y, EDGE_GAP) });
  }

  sorted.forEach((config) => {
    const current = ensurePanelState(config, state.panels[config.id]);
    if (current.hidden) {
      next[config.id] = current;
      return;
    }

    const width = Math.max(config.minWidth || DEFAULT_MIN_WIDTH, Math.min(DOCK_WIDTH, config.defaultRect.width));
    const height = Math.max(config.minHeight || DEFAULT_MIN_HEIGHT, current.collapsed ? 44 : config.defaultRect.height);
    const minHeight = current.collapsed ? 44 : config.minHeight || DEFAULT_MIN_HEIGHT;
    const column = columns.reduce((best, item) => {
      const bestOverflow = Math.max(0, best.y + height + EDGE_GAP - viewport.height);
      const itemOverflow = Math.max(0, item.y + height + EDGE_GAP - viewport.height);
      if (itemOverflow !== bestOverflow) return itemOverflow < bestOverflow ? item : best;
      return item.y < best.y ? item : best;
    });
    const availableHeight = Math.max(minHeight, viewport.height - column.y - EDGE_GAP);
    const arrangedHeight = Math.min(height, availableHeight);
    const rect = clampRect({ x: column.x, y: column.y, width, height: arrangedHeight }, viewport, config.minWidth, minHeight);
    next[config.id] = { ...current, rect };
    column.y = rect.y + rect.height + GRID_GAP;

    if (column.y + minHeight + EDGE_GAP > viewport.height) {
      column.y = Math.max(TOP_DOCK_Y, EDGE_GAP);
    }
  });

  return next;
}
