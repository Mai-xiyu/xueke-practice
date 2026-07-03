import { beforeEach, describe, expect, it } from "vitest";
import {
  CLIENT_ID_KEY,
  compareReviewPriority,
  getStudyClientId,
  isReviewDue,
  loadLocalProgress,
  markUncertain,
  masteryLevel,
  migrateSnapshotProgress,
  progressKey,
  recordQuestionAttempt,
  saveLocalProgress
} from "./progress";
import type { ProgressState } from "./types";

const EMPTY: ProgressState = { answers: {}, wrong: {}, favorites: {}, review: {}, details: {}, mockRuns: [] };

describe("progress migration", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${CLIENT_ID_KEY}=; Max-Age=0; Path=/`;
  });

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
    saveLocalProgress("linux-course", { answers: { q1: "B" }, wrong: {}, favorites: {}, review: {}, details: {}, mockRuns: [] });
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

  it("records attempts and schedules spaced review", () => {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const wrong = recordQuestionAttempt({ answers: {}, wrong: {}, favorites: {}, review: {}, details: {}, mockRuns: [] }, "q1", "A", false, now);
    expect(wrong.details.q1.attempts).toBe(1);
    expect(wrong.details.q1.correctStreak).toBe(0);
    expect(isReviewDue(wrong.details.q1, new Date("2026-06-30T00:09:00.000Z"))).toBe(false);
    expect(isReviewDue(wrong.details.q1, new Date("2026-06-30T00:10:00.000Z"))).toBe(true);

    const right = recordQuestionAttempt(wrong, "q1", "B", true, now);
    expect(right.details.q1.correctStreak).toBe(1);
    expect(right.wrong.q1).toBeUndefined();
    expect(isReviewDue(right.details.q1, new Date("2026-07-01T00:00:00.000Z"))).toBe(true);
  });

  it("tracks mastery level from attempt history", () => {
    const now = new Date("2026-06-30T00:00:00.000Z");
    expect(masteryLevel(undefined)).toBe("new");
    let state = recordQuestionAttempt(structuredClone(EMPTY), "q1", "A", false, now);
    expect(masteryLevel(state.details.q1)).toBe("weak");
    state = recordQuestionAttempt(state, "q1", "B", true, now);
    expect(masteryLevel(state.details.q1)).toBe("learning");
    state = recordQuestionAttempt(state, "q1", "B", true, now);
    state = recordQuestionAttempt(state, "q1", "B", true, now);
    expect(masteryLevel(state.details.q1)).toBe("mastered");
  });

  it("marks uncertain questions for short-interval review without counting attempts", () => {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const state = markUncertain(structuredClone(EMPTY), "q1", now);
    expect(state.review.q1).toBe(true);
    expect(state.wrong.q1).toBeUndefined();
    expect(state.details.q1.attempts).toBe(0);
    expect(state.details.q1.confidence).toBe(2);
    expect(isReviewDue(state.details.q1, new Date("2026-06-30T00:10:00.000Z"))).toBe(true);
  });

  it("prioritizes weak questions and earlier due dates in the review queue", () => {
    const now = new Date("2026-06-30T00:00:00.000Z");
    const weak = recordQuestionAttempt(structuredClone(EMPTY), "w1", "A", false, now).details.w1;
    const learning = recordQuestionAttempt(structuredClone(EMPTY), "l1", "B", true, now).details.l1;
    expect(compareReviewPriority(weak, learning)).toBeLessThan(0);
    expect(compareReviewPriority(learning, weak)).toBeGreaterThan(0);

    const earlier = recordQuestionAttempt(structuredClone(EMPTY), "e1", "A", false, new Date("2026-06-29T00:00:00.000Z")).details.e1;
    expect(compareReviewPriority(earlier, weak)).toBeLessThan(0);
  });

  it("uses a stable cookie-backed client id", () => {
    document.cookie = `${CLIENT_ID_KEY}=cookie-client-1; Path=/`;
    const id = getStudyClientId();
    expect(id).toBe("cookie-client-1");
    expect(localStorage.getItem(CLIENT_ID_KEY)).toBe("cookie-client-1");
    expect(document.cookie).toContain(`${CLIENT_ID_KEY}=cookie-client-1`);
  });
});
