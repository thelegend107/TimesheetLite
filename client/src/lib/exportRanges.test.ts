import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import { describe, expect, it } from "vitest";
import type { Entry } from "../api/types";
import { isoOf, parseIso } from "./dates";
import { ALL_TIME_START, DEFAULT_PRESET, type DateRangeValue, EXPORT_PRESETS, type ExportPresetId, MAX_RANGE_DAYS, customRangeProblem, describeSummary, formatExportRange, isExportPreset, presetRange, resolveExportRange, summarizeExport } from "./exportRanges";

const TODAY = parseIso("2026-10-02");

const range = (preset: ExportPresetId, reference: string, today = TODAY, custom: DateRangeValue | null = null) => resolveExportRange(preset, parseIso(reference), today, custom);

const custom = (start: string, end: string): DateRangeValue => ({ start: parseIso(start), end: parseIso(end) });

let nextId = 1;

const entry = (project: string, hours: number): Entry => ({
  id: nextId++,
  date: "2026-09-29",
  project,
  task: "Task",
  start: "08:00",
  end: "09:00",
  hours,
  notes: null,
  createdAt: "2026-10-02T12:00:00+00:00",
  updatedAt: "2026-10-02T12:00:00+00:00",
});

describe("preset list", () => {
  it("offers the presets in order with a custom range last", () => {
    expect(EXPORT_PRESETS.map((preset) => preset.label)).toEqual(["This week", "Last week", "This month", "Last month", "All time", "Custom range"]);
    expect(new Set(EXPORT_PRESETS.map((preset) => preset.id)).size).toBe(EXPORT_PRESETS.length);
  });

  it("defaults to the week", () => {
    expect(DEFAULT_PRESET).toBe("this-week");
  });

  it("recognises only listed ids", () => {
    expect(isExportPreset("last-month")).toBe(true);
    expect(isExportPreset("custom")).toBe(true);
    expect(isExportPreset("yesterday")).toBe(false);
    expect(isExportPreset(null)).toBe(false);
    expect(isExportPreset(3)).toBe(false);
  });
});

describe("this week", () => {
  it("runs Monday to Sunday around the reference day", () => {
    expect(range("this-week", "2026-10-02")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("keeps a Monday at the start and a Sunday at the end", () => {
    expect(range("this-week", "2026-09-28")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(range("this-week", "2026-10-04")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(range("this-week", "2026-10-05")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });

  it("crosses into the next year", () => {
    expect(range("this-week", "2026-12-31")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(range("this-week", "2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(range("this-week", "2027-01-03")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });

  it("starts in the previous year when the reference is early January", () => {
    expect(range("this-week", "2021-01-01")).toEqual({ from: "2020-12-28", to: "2021-01-03" });
  });

  it("follows the reference day, not today", () => {
    expect(range("this-week", "2026-05-20", parseIso("2026-10-02"))).toEqual({ from: "2026-05-18", to: "2026-05-24" });
    expect(range("this-week", "2026-05-20", parseIso("2030-01-01"))).toEqual({ from: "2026-05-18", to: "2026-05-24" });
  });
});

describe("last week", () => {
  it("is the seven days before this week", () => {
    expect(range("last-week", "2026-10-02")).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    expect(range("last-week", "2026-09-28")).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    expect(range("last-week", "2026-10-04")).toEqual({ from: "2026-09-21", to: "2026-09-27" });
  });

  it("crosses back over New Year", () => {
    expect(range("last-week", "2027-01-04")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(range("last-week", "2027-01-10")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(range("last-week", "2027-01-02")).toEqual({ from: "2026-12-21", to: "2026-12-27" });
    expect(range("last-week", "2021-01-01")).toEqual({ from: "2020-12-21", to: "2020-12-27" });
  });
});

describe("this month", () => {
  it("covers a 31 day month", () => {
    expect(range("this-month", "2026-10-02")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(range("this-month", "2026-01-31")).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("covers a 30 day month", () => {
    expect(range("this-month", "2026-09-30")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(range("this-month", "2026-04-01")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("covers a 28 day February", () => {
    expect(range("this-month", "2026-02-14")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(range("this-month", "2027-02-28")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
  });

  it("covers a 29 day February in a leap year", () => {
    expect(range("this-month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(range("this-month", "2024-02-29")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("follows the reference day, not today", () => {
    expect(range("this-month", "2026-05-20", parseIso("2026-10-02"))).toEqual({ from: "2026-05-01", to: "2026-05-31" });
  });
});

describe("last month", () => {
  it("steps back one month", () => {
    expect(range("last-month", "2026-10-02")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(range("last-month", "2026-12-01")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("lands in December of the previous year from January", () => {
    expect(range("last-month", "2027-01-15")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(range("last-month", "2027-01-01")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(range("last-month", "2027-01-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("handles a 28 day February from the end of March", () => {
    expect(range("last-month", "2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(range("last-month", "2026-03-01")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("handles a 29 day February from the end of March in a leap year", () => {
    expect(range("last-month", "2024-03-31")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("handles a 30 day month reached from a 31 day month", () => {
    expect(range("last-month", "2026-05-31")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
    expect(range("last-month", "2026-10-31")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("handles a 31 day month reached from a 30 day month", () => {
    expect(range("last-month", "2026-09-30")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });
});

describe("all time", () => {
  it("ends today and ignores the reference day", () => {
    expect(range("all-time", "2026-05-20", parseIso("2005-06-15"))).toEqual({ from: ALL_TIME_START, to: "2005-06-15" });
    expect(range("all-time", "2030-01-01", parseIso("2005-06-15"))).toEqual({ from: ALL_TIME_START, to: "2005-06-15" });
  });

  it("starts at the year 2000 while that is within the longest range the server accepts", () => {
    expect(ALL_TIME_START).toBe("2000-01-01");
    expect(range("all-time", "2010-01-08", parseIso("2010-01-08"))).toEqual({ from: "2000-01-01", to: "2010-01-08" });
    expect(range("all-time", "2026-10-02")).toEqual({ from: "2000-01-01", to: "2026-10-02" });
  });

  it("moves the start forward once the span would pass the server limit", () => {
    const far = parseIso("2200-01-01");

    expect(range("all-time", "2200-01-01", far)).toEqual({ from: isoOf(far.subtract({ days: MAX_RANGE_DAYS })), to: "2200-01-01" });
  });

  it("never exceeds the maximum span", () => {
    const result = presetRange("all-time", parseIso("2200-01-01"), parseIso("2200-01-01"));

    expect(parseIso(result.to).compare(parseIso(result.from))).toBe(MAX_RANGE_DAYS);
  });
});

describe("custom range", () => {
  it("passes a complete range through as ISO strings", () => {
    expect(range("custom", "2026-10-02", TODAY, custom("2026-09-01", "2026-09-15"))).toEqual({ from: "2026-09-01", to: "2026-09-15" });
  });

  it("accepts a single day", () => {
    expect(range("custom", "2026-10-02", TODAY, custom("2026-09-15", "2026-09-15"))).toEqual({ from: "2026-09-15", to: "2026-09-15" });
  });

  it("accepts ranges that cross a year boundary", () => {
    expect(range("custom", "2026-10-02", TODAY, custom("2025-12-30", "2026-01-02"))).toEqual({ from: "2025-12-30", to: "2026-01-02" });
  });

  it("ignores the reference day and today", () => {
    expect(range("custom", "2031-01-01", parseIso("2040-01-01"), custom("2026-09-01", "2026-09-15"))).toEqual({ from: "2026-09-01", to: "2026-09-15" });
  });

  it("is unresolved while a date is missing", () => {
    expect(range("custom", "2026-10-02", TODAY, null)).toBeNull();
    expect(customRangeProblem(null)).toBe("incomplete");
  });

  it("is unresolved when the end comes before the start", () => {
    const reversed = custom("2026-09-15", "2026-09-14");

    expect(range("custom", "2026-10-02", TODAY, reversed)).toBeNull();
    expect(customRangeProblem(reversed)).toBe("reversed");
  });

  it("accepts the longest range the server allows and rejects one day more", () => {
    const start = parseIso("2000-01-01");
    const longest = custom("2000-01-01", isoOf(start.add({ days: MAX_RANGE_DAYS })));
    const tooLong = custom("2000-01-01", isoOf(start.add({ days: MAX_RANGE_DAYS + 1 })));

    expect(customRangeProblem(longest)).toBeNull();
    expect(range("custom", "2026-10-02", TODAY, longest)).toEqual({ from: "2000-01-01", to: isoOf(start.add({ days: MAX_RANGE_DAYS })) });
    expect(customRangeProblem(tooLong)).toBe("too-long");
    expect(range("custom", "2026-10-02", TODAY, tooLong)).toBeNull();
  });

  it("reports no problem for a valid range", () => {
    expect(customRangeProblem(custom("2026-09-01", "2026-09-15"))).toBeNull();
  });

  it("drops the time of day from date-time values", () => {
    const withTimes: DateRangeValue = { start: new CalendarDateTime(2026, 9, 28, 23, 30), end: new CalendarDateTime(2026, 10, 4, 0, 15) };

    expect(range("custom", "2026-10-02", TODAY, withTimes)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(customRangeProblem(withTimes)).toBeNull();
  });

  it("is not used by the fixed presets", () => {
    expect(range("this-week", "2026-10-02", TODAY, custom("2020-01-01", "2020-01-02"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(range("this-week", "2026-10-02", TODAY, null)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("accepts calendar dates built directly", () => {
    expect(range("custom", "2026-10-02", TODAY, { start: new CalendarDate(2026, 2, 1), end: new CalendarDate(2026, 2, 28) })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("range label", () => {
  it("shows a single day with its year", () => {
    expect(formatExportRange({ from: "2026-09-15", to: "2026-09-15" })).toBe("Sep 15, 2026");
  });

  it("shows the year once inside a year", () => {
    expect(formatExportRange({ from: "2026-09-28", to: "2026-10-04" })).toBe("Sep 28 – Oct 4, 2026");
    expect(formatExportRange({ from: "2026-02-01", to: "2026-02-28" })).toBe("Feb 1 – Feb 28, 2026");
  });

  it("shows both years across a year boundary", () => {
    expect(formatExportRange({ from: "2026-12-28", to: "2027-01-03" })).toBe("Dec 28, 2026 – Jan 3, 2027");
    expect(formatExportRange({ from: "2016-09-24", to: "2026-10-02" })).toBe("Sep 24, 2016 – Oct 2, 2026");
  });
});

describe("export summary", () => {
  const entries = [entry("Alpha", 2.5), entry("Beta", 4), entry("Alpha", 1.25), entry("beta ", 0.5)];

  it("counts every entry and sums its hours when no project is chosen", () => {
    expect(summarizeExport(entries, null)).toEqual({ count: 4, hours: 8.25 });
  });

  it("filters by project without regard to case or surrounding spaces", () => {
    expect(summarizeExport(entries, "Alpha")).toEqual({ count: 2, hours: 3.75 });
    expect(summarizeExport(entries, "BETA")).toEqual({ count: 2, hours: 4.5 });
    expect(summarizeExport(entries, " alpha ")).toEqual({ count: 2, hours: 3.75 });
  });

  it("reports an unknown project as empty", () => {
    expect(summarizeExport(entries, "Gamma")).toEqual({ count: 0, hours: 0 });
  });

  it("reports an empty list as empty", () => {
    expect(summarizeExport([], null)).toEqual({ count: 0, hours: 0 });
  });

  it("adds hours without floating point drift", () => {
    expect(summarizeExport([entry("Alpha", 0.1), entry("Alpha", 0.2), entry("Alpha", 0.7)], null).hours).toBe(1);
  });
});

describe("summary text", () => {
  it("states entries and hours", () => {
    expect(describeSummary({ count: 37, hours: 38.5 })).toBe("37 entries, 38.5 hours");
    expect(describeSummary({ count: 5, hours: 40 })).toBe("5 entries, 40 hours");
    expect(describeSummary({ count: 2, hours: 2.75 })).toBe("2 entries, 2.75 hours");
  });

  it("uses singular nouns for exactly one", () => {
    expect(describeSummary({ count: 1, hours: 1 })).toBe("1 entry, 1 hour");
    expect(describeSummary({ count: 1, hours: 0.5 })).toBe("1 entry, 0.5 hours");
  });

  it("reads sensibly when nothing matches", () => {
    expect(describeSummary({ count: 0, hours: 0 })).toBe("0 entries, 0 hours");
  });
});
