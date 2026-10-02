import { describe, expect, it } from "vitest";
import { newWeekGoalState, shouldAnnounceWeek } from "./weekGoal";

const acted = (now: number) => {
  const state = newWeekGoalState();

  state.userActionAt = now;

  return state;
};

describe("shouldAnnounceWeek", () => {
  it("fires once when the user's own change crosses the target", () => {
    const state = acted(1000);

    expect(shouldAnnounceWeek(state, "w1", 39, 40, 1000)).toBe(false);
    expect(shouldAnnounceWeek(state, "w1", 40, 40, 2000)).toBe(true);
    expect(shouldAnnounceWeek(state, "w1", 39, 40, 3000)).toBe(false);
    expect(shouldAnnounceWeek(state, "w1", 41, 40, 4000)).toBe(false);
  });

  it("stays quiet on first load, other weeks' baselines and weeks already over", () => {
    const state = acted(1000);

    expect(shouldAnnounceWeek(state, "w1", 45, 40, 1000)).toBe(false);
    expect(shouldAnnounceWeek(state, "w2", 10, 40, 1000)).toBe(false);
    expect(shouldAnnounceWeek(state, "w1", 46, 40, 1500)).toBe(false);
  });

  it("ignores crossings the user did not cause, such as another tab or a refetch", () => {
    const state = newWeekGoalState();

    shouldAnnounceWeek(state, "w1", 39, 40, 100000);

    expect(shouldAnnounceWeek(state, "w1", 40, 40, 100001)).toBe(false);
  });

  it("keeps a baseline per week so navigating away and back still counts", () => {
    const state = acted(1000);

    shouldAnnounceWeek(state, "w1", 39, 40, 1000);
    shouldAnnounceWeek(state, "w2", 12, 40, 1100);

    expect(shouldAnnounceWeek(state, "w1", 40, 40, 1200)).toBe(true);
  });

  it("stops counting a change as the user's after the window passes", () => {
    const state = acted(1000);

    shouldAnnounceWeek(state, "w1", 39, 40, 1000);

    expect(shouldAnnounceWeek(state, "w1", 40, 40, 30000)).toBe(false);
  });
});
