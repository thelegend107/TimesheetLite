import { describe, expect, it } from "vitest";
import { endTimeOptions, endsNextDay, formatRange, formatTime, fromWireTime, hoursBetween, normalizeTimeText, parseTime, timeMatchesQuery, toWireTime } from "./time";

const at = (hour: number, minute = 0) => hour * 60 + minute;

describe("formatTime", () => {
  it.each([
    [at(0), "12:00 AM"],
    [at(8), "8:00 AM"],
    [at(12), "12:00 PM"],
    [at(12, 5), "12:05 PM"],
    [at(17, 25), "5:25 PM"],
    [at(23, 59), "11:59 PM"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatTime(minutes)).toBe(expected);
  });
});

describe("formatRange", () => {
  it.each([
    [at(8), at(10, 45), "8:00 – 10:45 AM"],
    [at(13), at(17), "1:00 – 5:00 PM"],
    [at(11, 30), at(13), "11:30 AM – 1:00 PM"],
    [at(22), at(1), "10:00 PM – 1:00 AM +1"],
    [at(20), at(0), "8:00 PM – 12:00 AM +1"],
  ])("writes %i to %i as %s", (start, end, expected) => {
    expect(formatRange(start, end)).toBe(expected);
  });
});

describe("wire times", () => {
  it("round-trips HH:mm and accepts HH:mm:ss", () => {
    expect(toWireTime(at(8, 5))).toBe("08:05");
    expect(fromWireTime("08:05")).toBe(at(8, 5));
    expect(fromWireTime("17:30:00")).toBe(at(17, 30));
    expect(fromWireTime(null)).toBeNull();
    expect(fromWireTime("8:05")).toBeNull();
  });
});

describe("hoursBetween", () => {
  it.each([
    [at(8), at(10, 45), 2.75],
    [at(16, 45), at(17), 0.25],
    [at(8), at(8, 35), 0.58],
    [at(8), at(8, 1), 0.02],
    [at(20), at(0), 4],
    [at(22), at(1), 3],
    [at(16, 45), at(5), 12.25],
    [at(8), at(8), 0],
  ])("from %i to %i is %f hours", (start, end, expected) => {
    expect(hoursBetween(start, end)).toBe(expected);
  });

  it("flags entries that end on the next day", () => {
    expect(endsNextDay(at(22), at(1))).toBe(true);
    expect(endsNextDay(at(8), at(9))).toBe(false);
    expect(endsNextDay(at(8), at(8))).toBe(false);
  });
});

describe("parseTime", () => {
  it.each([
    ["8", at(8)],
    ["8a", at(8)],
    ["8am", at(8)],
    ["8 AM", at(8)],
    ["8:30", at(8, 30)],
    ["8:30 pm", at(20, 30)],
    ["830", at(8, 30)],
    ["830a", at(8, 30)],
    ["830p", at(20, 30)],
    ["1430", at(14, 30)],
    ["1725", at(17, 25)],
    ["17:25", at(17, 25)],
    ["5:25p", at(17, 25)],
    ["5.25 p.m.", at(17, 25)],
    ["12a", at(0)],
    ["12am", at(0)],
    ["12p", at(12)],
    ["12:15 AM", at(0, 15)],
    ["0", at(0)],
    ["00:30", at(0, 30)],
    ["05:00", at(5)],
    ["noon", at(12)],
    ["midnight", at(0)],
    ["15p", at(13, 15)],
    ["45a", at(4, 45)],
  ])("reads %s as %i minutes", (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });

  it.each(["", "  ", "abc", "25", "24:00", "8:60", "0pm", "12345", "8:5", "-3", "8::30", "a"])("rejects %j", (input) => {
    expect(parseTime(input)).toBeNull();
  });

  it("picks the reading that ends soonest after the start for ambiguous hours", () => {
    expect(parseTime("5", at(16, 45))).toBe(at(17));
    expect(parseTime("5:00", at(16, 45))).toBe(at(17));
    expect(parseTime("10", at(8))).toBe(at(10));
    expect(parseTime("1", at(22))).toBe(at(1));
    expect(parseTime("12", at(8))).toBe(at(12));
    expect(parseTime("12", at(20))).toBe(at(0));
    expect(parseTime("8:30", at(16, 45))).toBe(at(20, 30));
    expect(parseTime("9", at(8, 45))).toBe(at(9));
    expect(parseTime("10", at(16, 45))).toBe(at(22));
    expect(parseTime("1030", at(16, 45))).toBe(at(22, 30));
  });

  it("treats a leading zero as an explicit morning time", () => {
    expect(parseTime("08", at(16, 45))).toBe(at(8));
    expect(parseTime("0830", at(16, 45))).toBe(at(8, 30));
  });

  it("does not guess when the user was explicit", () => {
    expect(parseTime("05:00", at(16, 45))).toBe(at(5));
    expect(parseTime("5a", at(16, 45))).toBe(at(5));
    expect(parseTime("17", at(16, 45))).toBe(at(17));
    expect(parseTime("1725", at(16, 45))).toBe(at(17, 25));
    expect(parseTime("0", at(16, 45))).toBe(at(0));
  });
});

describe("normalizeTimeText", () => {
  it("rewrites readable input and leaves unreadable input alone", () => {
    expect(normalizeTimeText("1725")).toBe("5:25 PM");
    expect(normalizeTimeText("5", at(16, 45))).toBe("5:00 PM");
    expect(normalizeTimeText("  nonsense ")).toBe("nonsense");
    expect(normalizeTimeText("")).toBe("");
  });
});

describe("endTimeOptions", () => {
  it("lists quarter hours after the start with durations, wrapping past midnight", () => {
    const options = endTimeOptions(at(16, 50));

    expect(options).toHaveLength(48);
    expect(options[0]).toEqual({ minutes: at(17), hours: 0.17 });
    expect(options[1]).toEqual({ minutes: at(17, 15), hours: 0.42 });
    expect(options.at(-1)?.minutes).toBe(at(4, 45));
    expect(options.every((option) => option.minutes % 15 === 0)).toBe(true);
  });

  it("falls back to the full day when there is no start", () => {
    expect(endTimeOptions(null)).toHaveLength(96);
  });
});

describe("timeMatchesQuery", () => {
  it.each([
    ["8:30 AM", "", true],
    ["8:30 AM", "8", true],
    ["8:30 AM", "830", true],
    ["8:30 AM", "830a", true],
    ["8:30 AM", "8:30 am", true],
    ["8:30 PM", "830a", false],
    ["10:00 AM", "8", false],
    ["8:30 AM", "08", false],
  ])("%s against %j is %s", (option, query, expected) => {
    expect(timeMatchesQuery(option, query)).toBe(expected);
  });
});
