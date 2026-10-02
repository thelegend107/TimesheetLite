import { describe, expect, it } from "vitest";
import type { Catalog, Entry } from "../api/types";
import { formatWeekRange, isoOf, parseIso, weekDays, weekStartOf } from "./dates";
import { entriesOn, findOverlap, suggestStart, summarizeWeek } from "./entries";
import { hoursShort, pluralize, sumHours } from "./format";
import { defaultProject, projectColor, taskSuggestions } from "./projects";
import { readPreference, resolveTheme, writePreference } from "./theme";

let nextId = 1;

const entry = (date: string, start: string | null, end: string | null, project = "Contoso", hours = 1): Entry => ({
  id: nextId++,
  date,
  project,
  task: "Task",
  start,
  end,
  hours,
  notes: null,
  createdAt: "2026-10-02T12:00:00+00:00",
  updatedAt: "2026-10-02T12:00:00+00:00",
});

describe("week math", () => {
  it("starts weeks on Monday", () => {
    expect(isoOf(weekStartOf(parseIso("2026-10-02")))).toBe("2026-09-28");
    expect(isoOf(weekStartOf(parseIso("2026-09-28")))).toBe("2026-09-28");
    expect(isoOf(weekStartOf(parseIso("2026-10-04")))).toBe("2026-09-28");
    expect(isoOf(weekStartOf(parseIso("2026-10-05")))).toBe("2026-10-05");
  });

  it("lists seven consecutive days", () => {
    const days = weekDays(parseIso("2026-09-28")).map(isoOf);

    expect(days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  });

  it("labels a week and shows years only where they differ", () => {
    expect(formatWeekRange(parseIso("2026-09-28"))).toBe("Sep 28 – Oct 4, 2026");
    expect(formatWeekRange(parseIso("2026-12-28"))).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});

describe("hours", () => {
  it("adds without floating point drift", () => {
    expect(sumHours([0.1, 0.2, 0.7])).toBe(1);
    expect(sumHours([0.58, 0.58, 0.58])).toBe(1.74);
    expect(sumHours([])).toBe(0);
  });

  it("trims trailing zeros for labels", () => {
    expect(hoursShort(8)).toBe("8");
    expect(hoursShort(7.5)).toBe("7.5");
    expect(hoursShort(2.75)).toBe("2.75");
    expect(pluralize(1, "entry", "entries")).toBe("1 entry");
    expect(pluralize(3, "entry", "entries")).toBe("3 entries");
  });
});

describe("entries", () => {
  it("returns a day's entries in time order", () => {
    const late = entry("2026-10-02", "13:00", "14:00");
    const early = entry("2026-10-02", "08:00", "09:00");
    const other = entry("2026-10-03", "07:00", "08:00");

    expect(entriesOn([late, other, early], "2026-10-02")).toEqual([early, late]);
  });

  it("suggests the latest end of the day, or 8:00 for an empty day", () => {
    expect(suggestStart([])).toBe(480);
    expect(suggestStart([entry("2026-10-02", "08:00", "09:30"), entry("2026-10-02", "09:30", "10:45")])).toBe(10 * 60 + 45);
    expect(suggestStart([entry("2026-10-02", "09:30", "10:45"), entry("2026-10-02", "08:00", "09:30")])).toBe(10 * 60 + 45);
    expect(suggestStart([entry("2026-10-02", "20:00", "00:00")])).toBe(480);
    expect(suggestStart([entry("2026-10-02", null, null)])).toBe(480);
  });

  it("summarizes a week by project and day", () => {
    const days = ["2026-09-28", "2026-09-29", "2026-09-30"];
    const summary = summarizeWeek(
      [entry("2026-09-28", "08:00", "09:00", "Northwind", 1.5), entry("2026-09-28", "09:00", "10:00", "Contoso", 2.25), entry("2026-09-29", "08:00", "09:00", "Contoso", 0.75), entry("2026-10-06", "08:00", "09:00", "Contoso", 9)],
      days,
    );

    expect(summary.rows.map((row) => [row.project, row.total])).toEqual([
      ["Contoso", 3],
      ["Northwind", 1.5],
    ]);
    expect(summary.rows[0]?.byDay.get("2026-09-28")).toBe(2.25);
    expect(summary.dayTotals.get("2026-09-28")).toBe(3.75);
    expect(summary.total).toBe(4.5);
  });

  it("finds overlapping entries on the same day only", () => {
    const existing = entry("2026-10-02", "09:00", "10:00");
    const entries = [existing, entry("2026-10-03", "09:00", "10:00")];

    expect(findOverlap(entries, "2026-10-02", 9 * 60 + 30, 11 * 60)).toBe(existing);
    expect(findOverlap(entries, "2026-10-02", 10 * 60, 11 * 60)).toBeNull();
    expect(findOverlap(entries, "2026-10-02", 8 * 60, 9 * 60)).toBeNull();
    expect(findOverlap(entries, "2026-10-02", 9 * 60 + 30, 11 * 60, existing.id)).toBeNull();
    expect(findOverlap(entries, "2026-10-04", 9 * 60, 10 * 60)).toBeNull();
  });

  it("treats an entry that runs past midnight as running into the next day", () => {
    const night = entry("2026-10-02", "22:00", "01:00");

    expect(findOverlap([night], "2026-10-02", 23 * 60, 23 * 60 + 30)).toBe(night);
    expect(findOverlap([night], "2026-10-02", 21 * 60, 22 * 60)).toBeNull();
    expect(findOverlap([night], "2026-10-03", 30, 90)).toBe(night);
    expect(findOverlap([night], "2026-10-03", 60, 120)).toBeNull();
    expect(findOverlap([night], "2026-10-02", 30, 90)).toBeNull();
  });

  it("finds an overlap between a new overnight entry and an existing early-morning entry", () => {
    const morning = entry("2026-10-03", "00:30", "01:30");

    expect(findOverlap([morning], "2026-10-02", 23 * 60, 60)).toBe(morning);
    expect(findOverlap([morning], "2026-10-02", 22 * 60, 30)).toBeNull();
  });

  it("works across month and year boundaries", () => {
    const newYear = entry("2027-01-01", "00:10", "01:00");

    expect(findOverlap([newYear], "2026-12-31", 23 * 60, 30)).toBe(newYear);
  });
});

const catalog: Catalog = {
  projects: [
    { name: "Contoso", uses: 404, lastUsed: "2026-09-29" },
    { name: "Northwind", uses: 68, lastUsed: "2026-09-30" },
  ],
  tasks: [
    { project: "Contoso", task: "Standup + wrapping up", uses: 12, lastUsed: "2026-09-28" },
    { project: "Contoso", task: "Stand-up + wrapping up", uses: 10, lastUsed: "2026-09-20" },
    { project: "Northwind", task: "Standup", uses: 20, lastUsed: "2026-09-01" },
    { project: "Contoso", task: "Reviewing work", uses: 2, lastUsed: "2026-09-10" },
  ],
};

describe("projects", () => {
  it("gives the two known projects different colors", () => {
    expect(projectColor("Contoso")).not.toBe(projectColor("Northwind"));
    expect(projectColor("contoso")).toBe(projectColor("Contoso"));
  });

  it("defaults to the last project of the day, then the most recently used", () => {
    expect(defaultProject([entry("2026-10-02", "08:00", "09:00", "Northwind")], catalog)).toBe("Northwind");
    expect(defaultProject([], catalog)).toBe("Northwind");
    expect(defaultProject([], undefined)).toBe("");
  });

  it("suggests tasks of the chosen project first, filtered by what was typed", () => {
    expect(taskSuggestions(catalog, "Contoso", "")).toEqual(["Standup + wrapping up", "Stand-up + wrapping up", "Reviewing work", "Standup"]);
    expect(taskSuggestions(catalog, "Northwind", "")[0]).toBe("Standup");
    expect(taskSuggestions(catalog, "Contoso", "wrap")).toEqual(["Standup + wrapping up", "Stand-up + wrapping up"]);
    expect(taskSuggestions(catalog, "Contoso", "standup + wrapping up")).toEqual([]);
    expect(taskSuggestions(catalog, "Contoso", "", 2)).toHaveLength(2);
    expect(taskSuggestions(undefined, "Contoso", "")).toEqual([]);
  });
});

describe("theme preference", () => {
  it("resolves system against the operating system setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("stores light and dark and clears the key for system, matching the previous app", () => {
    writePreference("dark");
    expect(localStorage.getItem("timesheetlite.theme")).toBe("dark");
    expect(readPreference()).toBe("dark");
    writePreference("system");
    expect(localStorage.getItem("timesheetlite.theme")).toBeNull();
    expect(readPreference()).toBe("system");
  });
});
