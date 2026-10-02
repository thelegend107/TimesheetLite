import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClockifyMapping, ClockifyProject, ClockifySyncAction, ClockifySyncItem, ClockifySyncOutcome, ClockifySyncResult, ClockifySyncSummary } from "../api/types";
import { actionChip, buildPlanRequest, effectiveMappings, endsNextDay, entryDetail, INCLUDE_NOTES_KEY, itemDateLabel, mappingNote, mappingValue, orderItems, orderProjects, outcomeChip, planNote, planSummary, projectMatches, projectOptionLabel, pushCount, pushLabel, pushToast, rangeLabel, readIncludeNotes, resultNote, resultSummary, scopeRange, timeRangeLabel, writeIncludeNotes } from "./clockifyPlan";
import { parseIso } from "./dates";

const summary = (partial: Partial<ClockifySyncSummary> = {}): ClockifySyncSummary => ({ create: 0, update: 0, delete: 0, unchanged: 0, blocked: 0, failed: 0, ...partial });

const item = (partial: Partial<ClockifySyncItem> = {}): ClockifySyncItem => ({
  entryId: 1,
  date: "2026-09-28",
  start: "08:00:00",
  end: "09:30:00",
  label: "Alpha · Weekly review",
  description: "Weekly review",
  action: "Create",
  outcome: "Planned",
  message: null,
  ...partial,
});

const result = (items: ClockifySyncItem[], partial: Partial<ClockifySyncSummary> = {}): ClockifySyncResult => ({ applied: true, summary: summary(partial), items });

const mapping = (project: string, clockifyProjectId: string | null, source: ClockifyMapping["source"]): ClockifyMapping => ({ project, clockifyProjectId, source });

describe("range of a scope", () => {
  it("is the selected day for the day scope", () => {
    expect(scopeRange("day", parseIso("2026-10-02"))).toEqual({ from: "2026-10-02", to: "2026-10-02" });
  });

  it("is Monday to Sunday of the selected week", () => {
    expect(scopeRange("week", parseIso("2026-09-30"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("keeps Monday and Sunday inside their own week", () => {
    expect(scopeRange("week", parseIso("2026-09-28"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(scopeRange("week", parseIso("2026-10-04"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(scopeRange("week", parseIso("2026-10-05"))).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });

  it("crosses a month boundary", () => {
    expect(scopeRange("week", parseIso("2026-10-02"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(scopeRange("week", parseIso("2026-03-02"))).toEqual({ from: "2026-03-02", to: "2026-03-08" });
    expect(scopeRange("week", parseIso("2026-03-01"))).toEqual({ from: "2026-02-23", to: "2026-03-01" });
  });

  it("crosses a year boundary", () => {
    expect(scopeRange("week", parseIso("2026-12-31"))).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(scopeRange("week", parseIso("2027-01-01"))).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(scopeRange("day", parseIso("2026-12-31"))).toEqual({ from: "2026-12-31", to: "2026-12-31" });
  });

  it("labels the range for the dialog", () => {
    expect(rangeLabel("day", parseIso("2026-10-02"))).toBe("Fri, Oct 2, 2026");
    expect(rangeLabel("week", parseIso("2026-10-02"))).toBe("Sep 28 – Oct 4, 2026");
    expect(rangeLabel("week", parseIso("2026-12-31"))).toBe("Dec 28, 2026 – Jan 3, 2027");
  });

  it("builds a preview request with the chosen options", () => {
    expect(buildPlanRequest("week", parseIso("2026-10-02"), true, { Alpha: "p1" })).toEqual({ from: "2026-09-28", to: "2026-10-04", includeNotes: true, apply: false, mappings: { Alpha: "p1" } });
    expect(buildPlanRequest("day", parseIso("2026-10-02"), false, {})).toEqual({ from: "2026-10-02", to: "2026-10-02", includeNotes: false, apply: false, mappings: {} });
  });
});

const project = (id: string, name: string, clientName = ""): ClockifyProject => ({ id, name, clientName });

describe("Clockify project choices", () => {
  const projects = [project("1", "Support", "Northwind"), project("2", "Conference"), project("3", "Support", "Adventure Works"), project("4", "GIS", "Northwind")];

  it("names the client so projects that share a name stay distinguishable", () => {
    expect(projectOptionLabel(projects[0]!)).toBe("Support · Northwind");
    expect(projectOptionLabel(projects[2]!)).toBe("Support · Adventure Works");
    expect(projectOptionLabel(projects[1]!)).toBe("Conference");
  });

  it("groups projects by client and then by name without touching the original list", () => {
    expect(orderProjects(projects).map((x) => x.id)).toEqual(["2", "3", "4", "1"]);
    expect(projects.map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("finds a project by any part of its name or client, in any order", () => {
    expect(projectMatches("Support · Northwind", "")).toBe(true);
    expect(projectMatches("Support · Northwind", "syn sup")).toBe(true);
    expect(projectMatches("Support · Northwind", "  SUPPORT  ")).toBe(true);
    expect(projectMatches("Support · Northwind", "orion")).toBe(false);
  });
});

describe("project mappings", () => {
  const mappings = [mapping("Alpha", "p1", "Saved"), mapping("Beta", "p2", "Name"), mapping("Gamma", null, "None")];

  it("preselects the server's choice and prefers the user's", () => {
    expect(mappingValue(mappings[0]!, {})).toBe("p1");
    expect(mappingValue(mappings[2]!, {})).toBeNull();
    expect(mappingValue(mappings[0]!, { Alpha: "p9" })).toBe("p9");
    expect(mappingValue(mappings[2]!, { Gamma: "p3" })).toBe("p3");
  });

  it("sends every selected project and leaves the unmapped ones out", () => {
    expect(effectiveMappings(mappings, {})).toEqual({ Alpha: "p1", Beta: "p2" });
    expect(effectiveMappings(mappings, { Gamma: "p3", Alpha: "p9" })).toEqual({ Alpha: "p9", Beta: "p2", Gamma: "p3" });
    expect(effectiveMappings([], { Alpha: "p1" })).toEqual({});
  });

  it("says how each mapping was found", () => {
    expect(mappingNote(mappings[0]!, {})).toBe("Saved from an earlier push");
    expect(mappingNote(mappings[1]!, {})).toBe("Matched by name");
    expect(mappingNote(mappings[2]!, {})).toBe("Choose a Clockify project. Until then its entries are blocked.");
  });

  it("says a changed choice is saved on the next push", () => {
    expect(mappingNote(mappings[2]!, { Gamma: "p3" })).toBe("Your choice, saved when you push");
    expect(mappingNote(mappings[0]!, { Alpha: "p9" })).toBe("Your choice, saved when you push");
    expect(mappingNote(mappings[0]!, { Alpha: "p1" })).toBe("Saved from an earlier push");
  });
});

describe("push count and label", () => {
  it("adds create, update and delete only", () => {
    expect(pushCount(summary({ create: 3, update: 1, delete: 2, unchanged: 9, blocked: 4, failed: 5 }))).toBe(6);
    expect(pushCount(summary({ unchanged: 4, blocked: 1 }))).toBe(0);
    expect(pushCount(summary())).toBe(0);
  });

  it("names the count with a singular and a plural form", () => {
    expect(pushLabel(1)).toBe("Push 1 change");
    expect(pushLabel(6)).toBe("Push 6 changes");
    expect(pushLabel(0)).toBe("Push changes");
  });
});

describe("plan summary", () => {
  it("lists what will happen and leaves out zeros", () => {
    expect(planSummary(summary({ create: 3, update: 1, unchanged: 2 }))).toBe("3 to create, 1 to update, 2 unchanged");
    expect(planSummary(summary({ create: 2 }))).toBe("2 to create");
    expect(planSummary(summary({ update: 4, unchanged: 1 }))).toBe("4 to update, 1 unchanged");
  });

  it("includes deletions and blocked entries", () => {
    expect(planSummary(summary({ create: 1, update: 1, delete: 1, unchanged: 1, blocked: 1 }))).toBe("1 to create, 1 to update, 1 to delete, 1 unchanged, 1 blocked");
    expect(planSummary(summary({ delete: 2 }))).toBe("2 to delete");
    expect(planSummary(summary({ create: 5, blocked: 2 }))).toBe("5 to create, 2 blocked");
  });

  it("says nothing to push when create, update and delete are all zero", () => {
    expect(planSummary(summary())).toBe("Nothing to push");
    expect(planSummary(summary({ unchanged: 2 }))).toBe("Nothing to push, 2 unchanged");
    expect(planSummary(summary({ unchanged: 1, blocked: 3 }))).toBe("Nothing to push, 1 unchanged, 3 blocked");
  });

  it("summarizes a finished push", () => {
    expect(resultSummary(summary({ create: 2, update: 1, unchanged: 4 }))).toBe("3 pushed, 4 unchanged");
    expect(resultSummary(summary({ create: 1, failed: 2, blocked: 1 }))).toBe("1 pushed, 2 failed, 1 blocked");
    expect(resultSummary(summary({ failed: 1 }))).toBe("1 failed");
    expect(resultSummary(summary())).toBe("Nothing was pushed");
  });
});

describe("push toast", () => {
  it("reports success with a singular and a plural form", () => {
    expect(pushToast(result([], { create: 3, delete: 1 }))).toEqual({ kind: "success", title: "Pushed 4 entries to Clockify" });
    expect(pushToast(result([], { update: 1 }))).toEqual({ kind: "success", title: "Pushed 1 entry to Clockify" });
  });

  it("does not claim a push when nothing was sent", () => {
    expect(pushToast(result([], { unchanged: 3 }))).toEqual({ kind: "success", title: "Nothing to push to Clockify" });
  });

  it("reports failures with the first failure message", () => {
    const items = [item({ outcome: "Done" }), item({ entryId: 2, outcome: "Failed", message: "Clockify answered 400." }), item({ entryId: 3, outcome: "Failed", message: "Clockify answered 500." })];

    expect(pushToast(result(items, { create: 1, failed: 2 }))).toEqual({ kind: "danger", title: "1 pushed, 2 failed", description: "Clockify answered 400." });
  });

  it("reports failures even when no message came back", () => {
    expect(pushToast(result([item({ outcome: "Failed" })], { failed: 1 }))).toEqual({ kind: "danger", title: "0 pushed, 1 failed", description: undefined });
  });
});

describe("action and outcome chips", () => {
  const actions: [ClockifySyncAction, string, string][] = [
    ["Create", "Create", "accent"],
    ["Update", "Update", "default"],
    ["Delete", "Delete", "danger"],
    ["Unchanged", "Unchanged", "default"],
    ["Blocked", "Blocked", "warning"],
  ];

  const outcomes: [ClockifySyncOutcome, string, string][] = [
    ["Done", "Done", "success"],
    ["Failed", "Failed", "danger"],
    ["Skipped", "Skipped", "default"],
    ["Planned", "Planned", "default"],
  ];

  it.each(actions)("maps the %s action to a label and a color", (action, label, color) => {
    expect(actionChip(action)).toEqual({ label, color });
  });

  it.each(outcomes)("maps the %s outcome to a label and a color", (outcome, label, color) => {
    expect(outcomeChip(outcome)).toEqual({ label, color });
  });

  it("uses an accent color only for create", () => {
    expect(actions.filter(([, , color]) => color === "accent").map(([action]) => action)).toEqual(["Create"]);
  });
});

describe("notes", () => {
  it("says a deleted entry will be removed from Clockify", () => {
    expect(planNote(item({ action: "Delete", start: null, end: null }))).toBe("Deleted here, will be removed from Clockify");
  });

  it("shows the server's reason for a blocked entry and nothing for the rest", () => {
    expect(planNote(item({ action: "Blocked", message: "No Clockify project is mapped to \"Gamma\"." }))).toBe("No Clockify project is mapped to \"Gamma\".");
    expect(planNote(item({ action: "Create" }))).toBe("");
    expect(planNote(item({ action: "Unchanged" }))).toBe("");
  });

  it("says what happened to each pushed entry", () => {
    expect(resultNote(item({ action: "Create", outcome: "Done" }))).toBe("Created in Clockify");
    expect(resultNote(item({ action: "Update", outcome: "Done" }))).toBe("Updated in Clockify");
    expect(resultNote(item({ action: "Delete", outcome: "Done" }))).toBe("Removed from Clockify");
    expect(resultNote(item({ action: "Unchanged", outcome: "Skipped" }))).toBe("Unchanged since the last push");
    expect(resultNote(item({ action: "Blocked", outcome: "Skipped", message: "Start and end times are required." }))).toBe("Start and end times are required.");
  });

  it("shows the failure message, with a fallback", () => {
    expect(resultNote(item({ outcome: "Failed", message: "Clockify answered 400." }))).toBe("Clockify answered 400.");
    expect(resultNote(item({ outcome: "Failed", message: null }))).toBe("Clockify did not accept this entry");
  });
});

describe("entry detail", () => {
  it("hides a description that only repeats the label", () => {
    expect(entryDetail(item())).toBeNull();
    expect(entryDetail(item({ description: "" }))).toBeNull();
    expect(entryDetail(item({ label: "Same", description: "Same" }))).toBeNull();
  });

  it("shows a description that adds something, on one line", () => {
    expect(entryDetail(item({ description: "Weekly review\n- agenda\n- actions" }))).toBe("Weekly review - agenda - actions");
    expect(entryDetail(item({ label: "Alpha · Planning", description: "Other text" }))).toBe("Other text");
  });
});

describe("row labels", () => {
  it("labels a date with its weekday", () => {
    expect(itemDateLabel("2026-09-28")).toBe("Mon, Sep 28");
    expect(itemDateLabel("2027-01-03")).toBe("Sun, Jan 3");
    expect(itemDateLabel("not a date")).toBe("not a date");
  });

  it("formats a time range in 12-hour style", () => {
    expect(timeRangeLabel("08:00:00", "09:30:00")).toBe("8:00 AM – 9:30 AM");
    expect(timeRangeLabel("12:00", "13:15")).toBe("12:00 PM – 1:15 PM");
    expect(timeRangeLabel("17:25:00", "18:40:00")).toBe("5:25 PM – 6:40 PM");
  });

  it("marks an entry that ends the next day", () => {
    expect(timeRangeLabel("22:00:00", "01:00:00")).toBe("10:00 PM – 1:00 AM");
    expect(endsNextDay("22:00:00", "01:00:00")).toBe(true);
    expect(endsNextDay("09:00:00", "09:00:00")).toBe(true);
    expect(endsNextDay("08:00:00", "09:30:00")).toBe(false);
    expect(endsNextDay(null, "09:30:00")).toBe(false);
    expect(endsNextDay("08:00:00", null)).toBe(false);
  });

  it("shows a dash when a time is missing", () => {
    expect(timeRangeLabel(null, null)).toBe("–");
    expect(timeRangeLabel("08:00:00", null)).toBe("–");
    expect(timeRangeLabel(null, "09:00:00")).toBe("–");
  });

  it("orders rows by day and start with untimed rows last", () => {
    const rows = [
      item({ entryId: 1, date: "2026-09-29", start: "08:00:00" }),
      item({ entryId: 2, date: "2026-09-28", start: null, end: null, action: "Delete" }),
      item({ entryId: 3, date: "2026-09-28", start: "13:00:00" }),
      item({ entryId: 4, date: "2026-09-28", start: "08:00:00" }),
    ];

    expect(orderItems(rows).map((row) => row.entryId)).toEqual([4, 3, 2, 1]);
    expect(rows.map((row) => row.entryId)).toEqual([1, 2, 3, 4]);
  });
});

describe("include notes preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to off", () => {
    expect(readIncludeNotes()).toBe(false);
  });

  it("stores the choice under its own key", () => {
    writeIncludeNotes(true);
    expect(localStorage.getItem(INCLUDE_NOTES_KEY)).toBe("true");
    expect(INCLUDE_NOTES_KEY).toBe("timesheetlite.clockify.includeNotes");
    expect(readIncludeNotes()).toBe(true);
    writeIncludeNotes(false);
    expect(readIncludeNotes()).toBe(false);
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem(INCLUDE_NOTES_KEY, "yes");
    expect(readIncludeNotes()).toBe(false);
  });

  it("works without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readIncludeNotes()).toBe(false);
    expect(() => writeIncludeNotes(true)).not.toThrow();
  });
});
