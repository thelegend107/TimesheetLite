import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClockifyMapping, ClockifyProject, ClockifySyncAction, ClockifySyncItem, ClockifySyncOutcome, ClockifySyncResult, ClockifySyncSummary } from "../api/types";
import { actionChip, applyCount, applyLabel, buildPlanRequest, clientFromKey, clientKey, clientLabel, clientNames, destinationLabel, draftsFromRules, draftsOf, dropRulesOutsideClient, effectiveClient, effectiveMappings, endsNextDay, entryDetail, INCLUDE_NOTES_KEY, itemDateLabel, mappingNote, mappingValue, orderItems, orderProjects, outcomeChip, planNote, planSummary, projectMatches, projectOptionLabel, projectsOfClient, pushCount, pushLabel, pushToast, rangeLabel, readIncludeNotes, resultNote, resultSummary, ruleRequests, scopeRange, suggestClient, timeRangeLabel, writeIncludeNotes } from "./clockifyPlan";
import { parseIso } from "./dates";

const summary = (partial: Partial<ClockifySyncSummary> = {}): ClockifySyncSummary => ({ create: 0, update: 0, delete: 0, link: 0, unchanged: 0, blocked: 0, failed: 0, ...partial });

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
  destination: null,
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
    const rule = { project: "Alpha", phrase: "standup", clockifyProjectId: "p2" };

    expect(buildPlanRequest("week", parseIso("2026-10-02"), true, { Alpha: "p1" }, [rule])).toEqual({ from: "2026-09-28", to: "2026-10-04", includeNotes: true, apply: false, mappings: { Alpha: "p1" }, rules: [rule] });
    expect(buildPlanRequest("day", parseIso("2026-10-02"), false, {}, [])).toEqual({ from: "2026-10-02", to: "2026-10-02", includeNotes: false, apply: false, mappings: {}, rules: [] });
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

describe("Clockify clients", () => {
  const projects = [project("1", "Software Development", "Northwind"), project("2", "GIS", "Northwind"), project("3", "Software Development", "Contoso Technologies"), project("4", "Conference"), project("5", "Meetings", "Contoso Core")];
  const clients = clientNames(projects);
  const gamma = mapping("Northwind", null, "None");

  it("lists each client once, alphabetically, with no client last", () => {
    expect(clients).toEqual(["Contoso Core", "Contoso Technologies", "Northwind", ""]);
  });

  it("turns the empty client into a key a menu can hold and a readable label", () => {
    expect(clientFromKey(clientKey(""))).toBe("");
    expect(clientFromKey(clientKey("Northwind"))).toBe("Northwind");
    expect(clientKey("")).not.toBe("");
    expect(clientLabel("")).toBe("No client");
    expect(clientLabel("Northwind")).toBe("Northwind");
  });

  it("offers only the chosen client's projects, or all of them when none is chosen", () => {
    expect(projectsOfClient(projects, "Northwind").map((x) => x.id)).toEqual(["1", "2"]);
    expect(projectsOfClient(projects, "").map((x) => x.id)).toEqual(["4"]);
    expect(projectsOfClient(projects, null)).toHaveLength(5);
  });

  it("suggests the client named like the local project", () => {
    expect(suggestClient(clients, "Northwind")).toBe("Northwind");
    expect(suggestClient(clients, " northwind ")).toBe("Northwind");
    expect(suggestClient(clients, "Contoso")).toBe("Contoso Technologies");
  });

  it("suggests nothing when the name is unknown, empty or fits several clients", () => {
    expect(suggestClient(clients, "Internal")).toBeNull();
    expect(suggestClient(clients, "  ")).toBeNull();
    expect(suggestClient(clients, "AG")).toBeNull();
  });

  it("uses the user's client first, then the saved project's client, then the name", () => {
    expect(effectiveClient(gamma, {}, {}, projects, clients)).toBe("Northwind");
    expect(effectiveClient(mapping("Northwind", "3", "Saved"), {}, {}, projects, clients)).toBe("Contoso Technologies");
    expect(effectiveClient(mapping("Northwind", "3", "Saved"), { Northwind: "5" }, {}, projects, clients)).toBe("Contoso Core");
    expect(effectiveClient(mapping("Northwind", "3", "Saved"), {}, { Northwind: "" }, projects, clients)).toBe("");
    expect(effectiveClient(mapping("Internal", null, "None"), {}, {}, projects, clients)).toBeNull();
  });

  it("drops a project the user cleared and tells the server to forget the saved one", () => {
    const saved = mapping("Northwind", "1", "Saved");

    expect(mappingValue(saved, { Northwind: "" })).toBeNull();
    expect(effectiveMappings([saved], { Northwind: "" })).toEqual({ Northwind: "" });
    expect(mappingNote(saved, { Northwind: "" })).toBe("Choose a Clockify project. Until then its entries are blocked.");
  });
});

describe("task rules", () => {
  const projects = [project("1", "Software Development", "Contoso Technologies"), project("2", "Meetings", "Contoso Technologies"), project("3", "Meetings", "Northwind")];
  const saved = [
    { project: "Contoso", phrase: "standup", clockifyProjectId: "2" },
    { project: "Northwind", phrase: "call", clockifyProjectId: "3" },
  ];

  it("turns saved rules into drafts with stable keys", () => {
    expect(draftsFromRules(saved)).toEqual([
      { key: "saved-0", project: "Contoso", phrase: "standup", clockifyProjectId: "2" },
      { key: "saved-1", project: "Northwind", phrase: "call", clockifyProjectId: "3" },
    ]);
  });

  it("sends only complete rules, with the wording trimmed", () => {
    const drafts = [
      { key: "a", project: "Contoso", phrase: "  standup ", clockifyProjectId: "2" },
      { key: "b", project: "Contoso", phrase: "", clockifyProjectId: "2" },
      { key: "c", project: "Contoso", phrase: "coding", clockifyProjectId: "" },
      { key: "d", project: "Contoso", phrase: "   ", clockifyProjectId: "1" },
    ];

    expect(ruleRequests(drafts)).toEqual([{ project: "Contoso", phrase: "standup", clockifyProjectId: "2" }]);
    expect(ruleRequests([])).toEqual([]);
  });

  it("finds the drafts of one local project", () => {
    const drafts = draftsFromRules(saved);

    expect(draftsOf(drafts, "Northwind").map((x) => x.key)).toEqual(["saved-1"]);
    expect(draftsOf(drafts, "Internal")).toEqual([]);
  });

  it("clears the project of a rule that is outside a newly chosen client and keeps its wording", () => {
    const drafts = draftsFromRules([...saved, { project: "Contoso", phrase: "admin", clockifyProjectId: "1" }]);
    const result = dropRulesOutsideClient(drafts, "Contoso", "Northwind", projects);

    expect(result.map((x) => [x.phrase, x.clockifyProjectId])).toEqual([
      ["standup", ""],
      ["call", "3"],
      ["admin", ""],
    ]);
    expect(dropRulesOutsideClient(drafts, "Contoso", "Contoso Technologies", projects)).toEqual(drafts);
  });

  it("says where an entry goes, or shows a dash", () => {
    expect(destinationLabel(item({ destination: "Meetings · Northwind" }))).toBe("Meetings · Northwind");
    expect(destinationLabel(item({ destination: null }))).toBe("–");
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

  it("counts entries already in Clockify as work for the button but not as pushed", () => {
    expect(pushCount(summary({ link: 4 }))).toBe(0);
    expect(applyCount(summary({ create: 2, link: 4, unchanged: 1 }))).toBe(6);
    expect(applyCount(summary({ unchanged: 3 }))).toBe(0);
  });

  it("labels the button for linking when nothing is sent to Clockify", () => {
    expect(applyLabel(summary({ link: 11 }))).toBe("Link 11 entries");
    expect(applyLabel(summary({ link: 1 }))).toBe("Link 1 entry");
    expect(applyLabel(summary({ create: 2, link: 4 }))).toBe("Push 2 changes");
    expect(applyLabel(summary())).toBe("Push changes");
    expect(applyLabel(undefined)).toBe("Push changes");
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

  it("says which entries are already in Clockify and does not call that a push", () => {
    expect(planSummary(summary({ link: 11 }))).toBe("11 already in Clockify");
    expect(planSummary(summary({ create: 2, link: 3, unchanged: 1 }))).toBe("2 to create, 3 already in Clockify, 1 unchanged");
    expect(planSummary(summary({ link: 2, blocked: 1 }))).toBe("2 already in Clockify, 1 blocked");
    expect(resultSummary(summary({ create: 1, link: 3 }))).toBe("1 pushed, 3 linked");
    expect(resultSummary(summary({ link: 2 }))).toBe("2 linked");
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

  it("says linked entries were linked, not pushed", () => {
    expect(pushToast(result([], { link: 11 }))).toEqual({ kind: "success", title: "Linked 11 entries already in Clockify" });
    expect(pushToast(result([], { link: 1 }))).toEqual({ kind: "success", title: "Linked 1 entry already in Clockify" });
    expect(pushToast(result([], { create: 2, link: 3 }))).toEqual({ kind: "success", title: "Pushed 2 entries and linked 3 already in Clockify" });
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
    ["Link", "In Clockify", "success"],
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
    expect(planNote(item({ action: "Link", message: "Already in Clockify. It will be linked, not duplicated." }))).toBe("Already in Clockify. It will be linked, not duplicated.");
    expect(planNote(item({ action: "Create" }))).toBe("");
    expect(planNote(item({ action: "Unchanged" }))).toBe("");
  });

  it("says what happened to each pushed entry", () => {
    expect(resultNote(item({ action: "Create", outcome: "Done" }))).toBe("Created in Clockify");
    expect(resultNote(item({ action: "Update", outcome: "Done" }))).toBe("Updated in Clockify");
    expect(resultNote(item({ action: "Delete", outcome: "Done" }))).toBe("Removed from Clockify");
    expect(resultNote(item({ action: "Link", outcome: "Done" }))).toBe("Linked to the entry already in Clockify");
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
