import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  clampRect,
  emptyFloatingLayout,
  ensurePanelState,
  focusQuestionArrange,
  type FloatingLayoutState,
  type FloatingPanelConfig,
  type FloatingPanelState,
  loadFloatingLayout,
  rightDockArrange,
  saveFloatingLayout
} from "../lib/floatingLayout";

interface FloatingLayoutProviderProps {
  subjectId: string;
  children: (api: FloatingLayoutApi) => ReactNode;
}

interface FloatingLayoutApi {
  state: FloatingLayoutState;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  reset: () => void;
  autoArrange: (configs: FloatingPanelConfig[]) => void;
  focusQuestion: (configs: FloatingPanelConfig[]) => void;
  updatePanel: (id: string, patch: Partial<FloatingPanelState>) => void;
  patchPanelRect: (id: string, rect: FloatingPanelState["rect"], configs?: FloatingPanelConfig[]) => void;
  bringToFront: (id: string) => void;
  hidePanel: (id: string) => void;
  restorePanel: (id: string) => void;
}

interface FloatingPanelProps {
  id: string;
  title: string;
  config: FloatingPanelConfig;
  state?: FloatingPanelState;
  onUpdate: (id: string, patch: Partial<FloatingPanelState>) => void;
  onRect: (id: string, rect: FloatingPanelState["rect"]) => void;
  onBringToFront: (id: string) => void;
  onHide: (id: string) => void;
  children: ReactNode;
}

interface RestoreTrayProps {
  items: Array<{ id: string; title: string; hidden: boolean }>;
  onRestore: (id: string) => void;
}

type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const EDGE_SIZE = 8;
const DEFAULT_MIN_WIDTH = 180;
const DEFAULT_MIN_HEIGHT = 96;

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function maxZ(panels: Record<string, FloatingPanelState>) {
  return Object.values(panels).reduce((max, panel) => Math.max(max, panel.zIndex || 1), 1);
}

function resizeEdge(event: ReactPointerEvent<HTMLElement>): ResizeEdge | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const left = event.clientX - rect.left <= EDGE_SIZE;
  const right = rect.right - event.clientX <= EDGE_SIZE;
  const top = event.clientY - rect.top <= EDGE_SIZE;
  const bottom = rect.bottom - event.clientY <= EDGE_SIZE;
  if (top && left) return "nw";
  if (top && right) return "ne";
  if (bottom && left) return "sw";
  if (bottom && right) return "se";
  if (top) return "n";
  if (bottom) return "s";
  if (left) return "w";
  if (right) return "e";
  return null;
}

function edgeCursor(edge: ResizeEdge | null) {
  if (!edge) return undefined;
  if (edge === "n" || edge === "s") return "ns-resize";
  if (edge === "e" || edge === "w") return "ew-resize";
  if (edge === "ne" || edge === "sw") return "nesw-resize";
  return "nwse-resize";
}

function resizeRect(rect: FloatingPanelState["rect"], edge: ResizeEdge, dx: number, dy: number, minWidth: number, minHeight: number) {
  const next = { ...rect };
  if (edge.includes("e")) next.width = Math.max(minWidth, rect.width + dx);
  if (edge.includes("s")) next.height = Math.max(minHeight, rect.height + dy);
  if (edge.includes("w")) {
    const x = Math.min(rect.x + dx, rect.x + rect.width - minWidth);
    next.x = x;
    next.width = rect.width + rect.x - x;
  }
  if (edge.includes("n")) {
    const y = Math.min(rect.y + dy, rect.y + rect.height - minHeight);
    next.y = y;
    next.height = rect.height + rect.y - y;
  }
  return next;
}

export function FloatingLayoutProvider({ subjectId, children }: FloatingLayoutProviderProps) {
  const [state, setState] = useState<FloatingLayoutState>(() => loadFloatingLayout(subjectId));

  useEffect(() => {
    setState(loadFloatingLayout(subjectId));
  }, [subjectId]);

  useEffect(() => {
    saveFloatingLayout(subjectId, state);
  }, [state, subjectId]);

  function updatePanel(id: string, patch: Partial<FloatingPanelState>) {
    setState((current) => ({
      ...current,
      panels: (() => {
        const hiddenNonQuestionCount = Object.entries(current.panels)
          .filter(([panelId, panel]) => panelId !== "question" && panel.hidden)
          .length;
        const shouldJoinFocusedLayout = id !== "question" &&
          !current.panels[id] &&
          Boolean(current.panels.question) &&
          !current.panels.question.hidden &&
          hiddenNonQuestionCount >= 3;
        const hidden = current.panels[id]
          ? patch.hidden ?? current.panels[id]?.hidden ?? false
          : shouldJoinFocusedLayout || patch.hidden || false;
        return {
          ...current.panels,
          [id]: {
            ...current.panels[id],
            ...patch,
            rect: patch.rect || current.panels[id]?.rect || { x: 16, y: 80, width: 260, height: 140 },
            opacity: patch.opacity ?? current.panels[id]?.opacity ?? 1,
            hidden,
            collapsed: patch.collapsed ?? current.panels[id]?.collapsed ?? false,
            zIndex: patch.zIndex ?? current.panels[id]?.zIndex ?? 1
          }
        };
      })()
    }));
  }

  function patchPanelRect(id: string, rect: FloatingPanelState["rect"], configs: FloatingPanelConfig[] = []) {
    setState((current) => {
      const config = configs.find((item) => item.id === id);
      const nextRect = clampRect(rect, viewport(), config?.minWidth, config?.minHeight);
      const existing = current.panels[id] || ensurePanelState(config || { id, defaultRect: nextRect });
      return {
        ...current,
        panels: {
          ...current.panels,
          [id]: { ...existing, rect: nextRect }
        }
      };
    });
  }

  function bringToFront(id: string) {
    setState((current) => {
      const existing = current.panels[id];
      if (!existing) return current;
      return {
        ...current,
        panels: {
          ...current.panels,
          [id]: { ...existing, zIndex: maxZ(current.panels) + 1 }
        }
      };
    });
  }

  function hidePanel(id: string) {
    updatePanel(id, { hidden: true });
  }

  function restorePanel(id: string) {
    setState((current) => {
      const existing = current.panels[id];
      if (!existing) return current;
      return {
        ...current,
        panels: {
          ...current.panels,
          [id]: {
            ...existing,
            hidden: false,
            zIndex: maxZ(current.panels) + 1,
            rect: clampRect(existing.rect, viewport())
          }
        }
      };
    });
  }

  function autoArrange(configs: FloatingPanelConfig[]) {
    setState((current) => ({
      ...current,
      panels: rightDockArrange(configs, current, viewport())
    }));
  }

  function focusQuestion(configs: FloatingPanelConfig[]) {
    setState((current) => ({
      ...current,
      panels: focusQuestionArrange(configs, current, viewport())
    }));
  }

  function reset() {
    setState(emptyFloatingLayout());
  }

  return children({
    state,
    enabled: state.enabled,
    setEnabled: (enabled) => setState((current) => ({ ...current, enabled })),
    reset,
    autoArrange,
    focusQuestion,
    updatePanel,
    patchPanelRect,
    bringToFront,
    hidePanel,
    restorePanel
  });
}

export function FloatingPanel({
  id,
  title,
  config,
  state,
  onUpdate,
  onRect,
  onBringToFront,
  onHide,
  children
}: FloatingPanelProps) {
  const panelState = ensurePanelState(config, state);
  const dragRef = useRef<{ kind: "move" | "resize"; edge?: ResizeEdge; startX: number; startY: number; rect: FloatingPanelState["rect"] } | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();

  useEffect(() => {
    if (!state) onUpdate(id, panelState);
  }, [id, onUpdate, panelState, state]);

  if (panelState.hidden) return null;

  function begin(kind: "move" | "resize", event: ReactPointerEvent, edge?: ResizeEdge) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind, edge, startX: event.clientX, startY: event.clientY, rect: panelState.rect };
    onBringToFront(id);
  }

  function move(event: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const rect = drag.kind === "move"
      ? { ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy }
      : resizeRect(
        drag.rect,
        drag.edge || "se",
        dx,
        dy,
        config.minWidth || DEFAULT_MIN_WIDTH,
        config.minHeight || DEFAULT_MIN_HEIGHT
      );
    const nextRect = clampRect(rect, viewport(), config.minWidth, config.minHeight);
    drag.rect = nextRect;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    onUpdate(id, { rect: nextRect });
  }

  function end(event: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onRect(id, drag.rect);
  }

  function beginPanelResize(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || panelState.collapsed) return;
    if ((event.target as HTMLElement).closest(".floating-panel__bar")) return;
    const edge = resizeEdge(event);
    if (edge) begin("resize", event, edge);
  }

  function updateCursor(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current || panelState.collapsed) return;
    if ((event.target as HTMLElement).closest(".floating-panel__bar")) {
      setCursor(undefined);
      return;
    }
    setCursor(edgeCursor(resizeEdge(event)));
  }

  return (
    <section
      className={`floating-panel${panelState.collapsed ? " collapsed" : ""}`}
      data-panel-id={id}
      style={{
        left: panelState.rect.x,
        top: panelState.rect.y,
        width: panelState.rect.width,
        height: panelState.collapsed ? 44 : panelState.rect.height,
        opacity: panelState.opacity,
        zIndex: panelState.zIndex,
        cursor
      }}
      onPointerDown={(event) => {
        onBringToFront(id);
        beginPanelResize(event);
      }}
      onPointerMove={(event) => {
        updateCursor(event);
        move(event);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => {
        if (!dragRef.current) setCursor(undefined);
      }}
    >
      <div className="floating-panel__bar" onPointerDown={(event) => begin("move", event)} onDoubleClick={() => onHide(id)}>
        <strong>{title}</strong>
        <button type="button" className="floating-panel__minimize" title="最小化窗口" onClick={() => onHide(id)} aria-label={`最小化${title}`}>_</button>
      </div>
      {!panelState.collapsed ? <div className="floating-panel__body">{children}</div> : null}
    </section>
  );
}

export function RestoreTray({ items, onRestore }: RestoreTrayProps) {
  const hiddenItems = items.filter((item) => item.hidden);
  if (!hiddenItems.length) return null;
  return (
    <aside className="floating-taskbar" aria-label="已最小化窗口">
      {hiddenItems.map((item) => (
        <button key={item.id} type="button" onClick={() => onRestore(item.id)}>
          {item.title}
        </button>
      ))}
    </aside>
  );
}
