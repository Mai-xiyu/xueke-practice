import { beforeEach, describe, expect, it } from "vitest";
import { loadLocalProgress, migrateSnapshotProgress, progressKey, saveLocalProgress } from "./progress";

describe("progress migration", () => {
  beforeEach(() => localStorage.clear());

  it("migrates legacy route-switching state without deleting old key", () => {
    localStorage.setItem("network-practice-v1", JSON.stringify({ answers: { q1: "A" }, wrong: { q2: true }, favorites: { q3: true } }));
    const state = loadLocalProgress("route-switching");
    expect(state.answers.q1).toBe("A");
    expect(state.wrong.q2).toBe(true);
    expect(state.favorites.q3).toBe(true);
    expect(localStorage.getItem("network-practice-v1")).toBeTruthy();
    expect(localStorage.getItem(progressKey("route-switching"))).toBeTruthy();
  });

  it("saves v2 state", () => {
    saveLocalProgress("linux-course", { answers: { q1: "B" }, wrong: {}, favorites: {}, mockRuns: [] });
    expect(JSON.parse(localStorage.getItem(progressKey("linux-course")) || "{}").answers.q1).toBe("B");
  });

  it("migrates legacy keys from a backend snapshot", () => {
    const snapshot = {
      netsec_practice_v1: JSON.stringify({ answers: { q1: "C" }, wrong: ["q2"], marked: ["q3"] })
    };
    const state = migrateSnapshotProgress("network-security", snapshot);
    expect(state?.answers.q1).toBe("C");
    expect(state?.wrong.q2).toBe(true);
    expect(state?.favorites.q3).toBe(true);
    expect(state?.migratedFrom).toEqual(["netsec_practice_v1"]);
  });
});
