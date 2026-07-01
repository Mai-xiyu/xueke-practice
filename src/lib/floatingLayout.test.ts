import { beforeEach, describe, expect, it } from "vitest";
import {
  avoidOverlap,
  clampRect,
  floatingLayoutKey,
  loadFloatingLayout,
  nextOpacity,
  rightDockArrange,
  saveFloatingLayout,
  type FloatingPanelConfig
} from "./floatingLayout";

const configs: FloatingPanelConfig[] = [
  { id: "question", defaultRect: { x: 20, y: 200, width: 640, height: 420 }, minWidth: 360, minHeight: 220, priority: 1 },
  { id: "answer", defaultRect: { x: 900, y: 100, width: 260, height: 160 }, minWidth: 200, minHeight: 120, priority: 2 },
  { id: "stats", defaultRect: { x: 900, y: 280, width: 260, height: 120 }, minWidth: 180, minHeight: 90, priority: 3 }
];

describe("floating layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back when localStorage JSON is invalid", () => {
    localStorage.setItem(floatingLayoutKey("route-switching"), "{bad");
    expect(loadFloatingLayout("route-switching")).toEqual({ enabled: false, panels: {} });
  });

  it("saves and loads layout state by subject", () => {
    saveFloatingLayout("linear-algebra", {
      enabled: true,
      panels: {
        answer: {
          rect: { x: 100, y: 120, width: 240, height: 160 },
          opacity: 0.85,
          hidden: true,
          collapsed: false,
          zIndex: 9
        }
      }
    });
    const state = loadFloatingLayout("linear-algebra");
    expect(state.enabled).toBe(true);
    expect(state.panels.answer.hidden).toBe(true);
    expect(state.panels.answer.opacity).toBe(0.85);
  });

  it("clamps rectangles to the viewport and minimum size", () => {
    expect(clampRect({ x: -100, y: -50, width: 80, height: 40 }, { width: 500, height: 360 }, 180, 90)).toEqual({
      x: 12,
      y: 12,
      width: 180,
      height: 90
    });
  });

  it("cycles opacity through the supported steps", () => {
    expect(nextOpacity(1)).toBe(0.85);
    expect(nextOpacity(0.85)).toBe(0.65);
    expect(nextOpacity(0.65)).toBe(0.45);
    expect(nextOpacity(0.45)).toBe(1);
  });

  it("arranges visible panels without overlap and keeps hidden panels hidden", () => {
    const arranged = rightDockArrange(configs, {
      enabled: true,
      panels: {
        stats: {
          rect: { x: 1, y: 1, width: 260, height: 120 },
          opacity: 1,
          hidden: true,
          collapsed: false,
          zIndex: 1
        }
      }
    }, { width: 1200, height: 800 });

    expect(arranged.stats.hidden).toBe(true);
    expect(arranged.question.rect.x + arranged.question.rect.width).toBeLessThan(arranged.answer.rect.x);
    expect(arranged.answer.rect.y).toBeGreaterThanOrEqual(12);
  });

  it("moves a conflicting rect away from existing windows", () => {
    const rect = avoidOverlap(
      { x: 100, y: 100, width: 200, height: 120 },
      [{ x: 100, y: 100, width: 200, height: 120 }],
      { width: 800, height: 600 },
      180,
      90
    );
    expect(rect.y).toBeGreaterThan(100);
  });
});

