import { describe, expect, it } from "vitest";
import { splitServerErrors } from "./formErrors";

describe("splitServerErrors", () => {
  const visible = ["project", "task", "start", "end", "notes"];

  it("maps errors for fields that are on screen, ignoring key case", () => {
    expect(splitServerErrors({ Task: ["Task is required."], end: ["Bad end."] }, visible)).toEqual({ mapped: { task: "Task is required.", end: "Bad end." }, leftover: [] });
  });

  it("keeps the message of any error that has no visible field so it can be shown another way", () => {
    expect(splitServerErrors({ date: ["Date must be between 2000 and 2100."], "": ["Unreadable body."] }, visible)).toEqual({ mapped: {}, leftover: ["Date must be between 2000 and 2100.", "Unreadable body."] });
  });

  it("takes the first message per field and skips empty lists", () => {
    expect(splitServerErrors({ notes: ["First.", "Second."], project: [] }, visible)).toEqual({ mapped: { notes: "First." }, leftover: [] });
  });
});
