const USER_ACTION_WINDOW_MS = 20000;

export type WeekGoalState = { totals: Map<string, number>; announced: Set<string>; userActionAt: number };

export const newWeekGoalState = (): WeekGoalState => ({ totals: new Map(), announced: new Set(), userActionAt: Number.NEGATIVE_INFINITY });

export function shouldAnnounceWeek(state: WeekGoalState, weekKey: string, total: number, target: number, now: number): boolean {
  const previous = state.totals.get(weekKey);

  state.totals.set(weekKey, total);

  if (previous === undefined || previous >= target || total < target || state.announced.has(weekKey) || now - state.userActionAt > USER_ACTION_WINDOW_MS) {
    return false;
  }

  state.announced.add(weekKey);

  return true;
}
