import { I18nProvider, toast } from "@heroui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Catalog, Entry, EntryInput } from "../api/types";
import { EntryForm } from "./EntryForm";

let nextId = 1;

const entry = (date: string, start: string, end: string, project = "Contoso", task = "Existing"): Entry => ({
  id: nextId++,
  date,
  project,
  task,
  start,
  end,
  hours: 1,
  notes: null,
  createdAt: "2026-10-02T12:00:00+00:00",
  updatedAt: "2026-10-02T12:00:00+00:00",
});

const catalog: Catalog = {
  projects: [
    { name: "Contoso", uses: 5, lastUsed: "2026-10-01" },
    { name: "Northwind", uses: 2, lastUsed: "2026-09-30" },
  ],
  tasks: [{ project: "Contoso", task: "Standup + wrapping up", uses: 4, lastUsed: "2026-10-01" }],
};

type Overrides = Partial<React.ComponentProps<typeof EntryForm>>;

function setup(overrides: Overrides = {}) {
  const onSubmit = vi.fn<(input: EntryInput) => Promise<void>>().mockResolvedValue();
  const view = render(
    <I18nProvider locale="en-US">
      <EntryForm catalog={catalog} date="2026-10-02" isSubmitting={false} mode="add" weekEntries={[]} onSubmit={onSubmit} {...overrides} />
    </I18nProvider>,
  );

  return { onSubmit, user: userEvent.setup(), ...view };
}

const field = (name: string) => screen.getByRole("combobox", { name });

describe("EntryForm add flow", () => {
  it("starts the day at 8:00 AM when nothing is logged", () => {
    setup();

    expect(field("From")).toHaveValue("8:00 AM");
    expect(field("To")).toHaveValue("");
    expect(field("Project")).toHaveValue("Contoso");
  });

  it("chains the start from the last end of the day and keeps that day's project", () => {
    setup({ weekEntries: [entry("2026-10-02", "08:00", "09:30", "Northwind"), entry("2026-10-02", "09:30", "10:45", "Northwind"), entry("2026-10-01", "08:00", "17:00")] });

    expect(field("From")).toHaveValue("10:45 AM");
    expect(field("Project")).toHaveValue("Northwind");
  });

  it("reads a bare hour in To as the reading that ends soonest after the start", async () => {
    const { user } = setup({ weekEntries: [entry("2026-10-02", "08:00", "16:45")] });

    await user.type(field("To"), "5");

    expect(screen.getByText("0.25 h")).toBeInTheDocument();

    await user.tab();

    expect(field("To")).toHaveValue("5:00 PM");
    expect(screen.getByText("0.25 h")).toBeInTheDocument();
  });

  it("explains each missing field instead of submitting", async () => {
    const { user, onSubmit } = setup({ catalog: undefined });

    await user.click(screen.getByRole("button", { name: "Add entry" }));

    expect(await screen.findByText("Choose or type a project.")).toBeInTheDocument();
    expect(screen.getByText("Describe the task.")).toBeInTheDocument();
    expect(screen.getByText("Enter an end time such as 5:00 PM or 1700.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an end equal to the start", async () => {
    const { user, onSubmit } = setup();

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "8:00 AM");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    expect(await screen.findByText("The end time must differ from the start time.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits wire-format times and trimmed text, then keeps the project and clears the rest", async () => {
    const { user, onSubmit } = setup();

    await user.clear(field("Project"));
    await user.type(field("Project"), "Northwind");
    await user.type(field("Task"), "  Implement export  ");
    await user.type(field("To"), "1015");
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "- one{Enter}- two");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ date: "2026-10-02", project: "Northwind", task: "Implement export", start: "08:00", end: "10:15", notes: "- one\n- two" });

    await waitFor(() => expect(field("Task")).toHaveValue(""));
    expect(field("Project")).toHaveValue("Northwind");
    expect(field("To")).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("");
    expect(field("Task")).toHaveFocus();
  });

  it("stays cleared when Enter in the To field submits and moves focus away", async () => {
    const { user, onSubmit } = setup();

    await user.type(field("Task"), "Pairing");
    await user.type(field("To"), "6");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(field("Task")).toHaveFocus());

    expect(field("To")).toHaveValue("");
    expect(field("Task")).toHaveValue("");
    expect(screen.getByText("Hours appear once both times are valid.")).toBeInTheDocument();
  });

  it("submits once when the shortcut fires twice before the first save finishes", async () => {
    const { user, onSubmit } = setup();

    onSubmit.mockImplementation(() => new Promise<void>(() => {}));

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await user.keyboard("{Control>}{Enter}{Enter}{/Control}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps over-long pasted notes intact and refuses to save until they are shortened", async () => {
    const { user, onSubmit } = setup();
    const notes = screen.getByRole("textbox", { name: "Notes" });

    await user.click(notes);
    await user.paste("x".repeat(1001));
    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    expect(notes).toHaveValue("x".repeat(1001));
    expect(await screen.findByText("The notes are 1001 characters; the limit is 1,000.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reports an over-long task instead of cutting it", async () => {
    const { user, onSubmit } = setup();

    await user.click(field("Task"));
    await user.paste("t".repeat(101));
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    expect(await screen.findByText("The task is 101 characters; the limit is 100.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("saves a project typed in another case under the spelling that already exists", async () => {
    const { user, onSubmit } = setup();

    await user.clear(field("Project"));
    await user.type(field("Project"), "contoso");
    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0].project).toBe("Contoso");
  });

  it("keeps text typed while the save is still in flight", async () => {
    const { user, onSubmit } = setup();
    let finish: () => void = () => {};

    onSubmit.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(field("Task")).toHaveFocus());
    await user.type(field("Task"), "Next one");

    finish();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(field("Task")).toHaveValue("Next one");
  });

  it("puts the entry back when the save fails and nothing new was typed", async () => {
    const { user, onSubmit } = setup();

    onSubmit.mockRejectedValueOnce(new Error("The server could not be reached."));

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "keep me");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(field("Task")).toHaveValue("Planning"));
    expect(field("To")).toHaveValue("9:00 AM");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("keep me");
  });

  it("does not overwrite newly typed text when an earlier save fails", async () => {
    const { user, onSubmit } = setup();
    let fail: (error: Error) => void = () => {};

    onSubmit.mockImplementation(() => new Promise<void>((_, reject) => { fail = reject; }));

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(field("Task")).toHaveFocus());
    await user.type(field("Task"), "Next one");

    fail(new Error("The server could not be reached."));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(field("Task")).toHaveValue("Next one");
  });

  it("puts a failed entry back into the draft of its own day, not the day now showing", async () => {
    const { user, onSubmit, rerender } = setup();
    const danger = vi.spyOn(toast, "danger").mockReturnValue("toast");
    let fail: (error: Error) => void = () => {};

    onSubmit.mockImplementation(() => new Promise<void>((_, reject) => { fail = reject; }));

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const showDay = (day: string) =>
      rerender(
        <I18nProvider locale="en-US">
          <EntryForm catalog={catalog} date={day} isSubmitting={false} mode="add" weekEntries={[]} onSubmit={onSubmit} />
        </I18nProvider>,
      );

    showDay("2026-10-03");
    fail(new Error("The server could not be reached."));

    await waitFor(() => expect(danger).toHaveBeenCalledTimes(1));

    expect(field("Task")).toHaveValue("");
    expect(danger.mock.calls[0]?.[1]).toMatchObject({ description: expect.stringContaining("back in the draft for 2026-10-02") });

    showDay("2026-10-02");

    expect(field("Task")).toHaveValue("Planning");
    expect(field("To")).toHaveValue("9:00 AM");

    danger.mockRestore();
  });

  it("keeps a separate draft for each day", async () => {
    const { user, onSubmit, rerender } = setup();
    const showDay = (day: string) =>
      rerender(
        <I18nProvider locale="en-US">
          <EntryForm catalog={catalog} date={day} isSubmitting={false} mode="add" weekEntries={[]} onSubmit={onSubmit} />
        </I18nProvider>,
      );

    await user.type(field("Task"), "Monday work");
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "monday notes");
    showDay("2026-10-03");

    expect(field("Task")).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("");

    await user.type(field("Task"), "Tuesday work");
    showDay("2026-10-02");

    expect(field("Task")).toHaveValue("Monday work");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("monday notes");

    showDay("2026-10-03");

    expect(field("Task")).toHaveValue("Tuesday work");
  });

  it("adds with Cmd+Enter from any field, not only from Notes", async () => {
    const { user, onSubmit } = setup();

    await user.type(field("To"), "9");
    await user.type(field("Task"), "Quick one");
    fireEvent.keyDown(field("Task"), { key: "Enter", metaKey: true });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0].task).toBe("Quick one");
  });

  it("counts notes the way they are stored, without surrounding whitespace", async () => {
    const { user } = setup();

    await user.type(screen.getByRole("textbox", { name: "Notes" }), "  hello  ");

    expect(screen.getByText("5 / 1000")).toBeInTheDocument();
  });

  it("keeps Add entry usable while an earlier add is still saving", async () => {
    const { user, onSubmit } = setup({ isSubmitting: true });

    await user.type(field("Task"), "Second entry");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("does not take focus on mount for a focus request that was already handled", () => {
    vi.useFakeTimers();

    setup({ focusSignal: 1 });
    vi.advanceTimersByTime(400);

    expect(field("Task")).not.toHaveFocus();

    vi.useRealTimers();
  });

  it("focuses Task after the focus signal increases", () => {
    vi.useFakeTimers();

    const { rerender, onSubmit } = setup({ focusSignal: 1 });

    rerender(
      <I18nProvider locale="en-US">
        <EntryForm catalog={catalog} date="2026-10-02" focusSignal={2} isSubmitting={false} mode="add" weekEntries={[]} onSubmit={onSubmit} />
      </I18nProvider>,
    );
    vi.advanceTimersByTime(400);

    expect(field("Task")).toHaveFocus();

    vi.useRealTimers();
  });

  it("announces a saved entry to assistive technology", async () => {
    const { user } = setup();

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Added Planning, 1.00 hours."));
  });

  it("moves focus to the first field that needs attention", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => expect(field("Task")).toHaveFocus());
  });

  it("reads a bare hour typed in From as the next occurrence after the day's last end", async () => {
    const { user } = setup({ weekEntries: [entry("2026-10-02", "08:00", "12:30")] });

    await user.type(field("To"), "2:00 PM");
    await user.clear(field("From"));
    await user.type(field("From"), "1");

    expect(screen.getByText("1.00 h")).toBeInTheDocument();

    await user.tab();

    expect(field("From")).toHaveValue("1:00 PM");
  });

  it("chains the next start from the end that was just sent, before the list refreshes", async () => {
    const { user, onSubmit } = setup();

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(field("From")).toHaveValue("9:00 AM");
  });

  it("falls back to the project of the day being viewed once the day changes", async () => {
    const { user, onSubmit, rerender } = setup();

    await user.clear(field("Project"));
    await user.type(field("Project"), "Northwind");
    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(field("Project")).toHaveValue("Northwind");

    rerender(
      <I18nProvider locale="en-US">
        <EntryForm catalog={catalog} date="2026-10-03" isSubmitting={false} mode="add" weekEntries={[entry("2026-10-03", "08:00", "09:00", "Contoso")]} onSubmit={onSubmit} />
      </I18nProvider>,
    );

    expect(field("Project")).toHaveValue("Contoso");
  });

  it("flags entries that end the next day", async () => {
    const { user } = setup({ weekEntries: [entry("2026-10-02", "08:00", "22:00")] });

    await user.type(field("To"), "1:00 AM");
    await user.tab();

    expect(await screen.findByText("Ends the next day")).toBeInTheDocument();
    expect(screen.getByText("3.00 h")).toBeInTheDocument();
  });

  it("warns when the new entry overlaps an existing one", async () => {
    const { user } = setup({ weekEntries: [entry("2026-10-02", "08:00", "10:00", "Contoso", "Existing block")] });

    await user.clear(field("From"));
    await user.type(field("From"), "9:00 AM");
    await user.type(field("To"), "11:00 AM");
    await user.tab();

    expect(await screen.findByText("Overlaps Existing block")).toBeInTheDocument();
  });

  it("counts notes against the 1000 character limit", async () => {
    const { user } = setup();

    await user.type(screen.getByRole("textbox", { name: "Notes" }), "hello");

    expect(screen.getByText("5 / 1000")).toBeInTheDocument();
  });

  it("stays on the form and reports a server rejection", async () => {
    const { user, onSubmit } = setup();
    const { ApiError } = await import("../api/client");

    onSubmit.mockRejectedValueOnce(new ApiError(400, "Task is required.", { task: ["Task must be 100 characters or fewer."] }));

    await user.type(field("Task"), "Planning");
    await user.type(field("To"), "9:00 AM");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    expect(await screen.findByText("Task must be 100 characters or fewer.")).toBeInTheDocument();
    expect(field("Task")).toHaveValue("Planning");
  });
});

describe("EntryForm edit mode", () => {
  it("opens with the entry values and saves changes with its date", async () => {
    const existing = { ...entry("2026-10-01", "08:00", "09:30", "Northwind", "Existing task"), notes: "kept" };
    const { user, onSubmit } = setup({ mode: "edit", entry: existing, date: existing.date, weekEntries: [existing] });

    expect(field("Task")).toHaveValue("Existing task");
    expect(field("From")).toHaveValue("8:00 AM");
    expect(field("To")).toHaveValue("9:30 AM");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("kept");

    await user.clear(field("To"));
    await user.type(field("To"), "10:00 AM");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ date: "2026-10-01", project: "Northwind", task: "Existing task", start: "08:00", end: "10:00", notes: "kept" }));
  });

  it("refuses to save while the date is only partly entered", async () => {
    const existing = entry("2026-10-01", "08:00", "09:30", "Northwind", "Existing task");
    const { user, onSubmit } = setup({ mode: "edit", entry: existing, date: existing.date, weekEntries: [existing] });

    await user.click(screen.getByRole("spinbutton", { name: /month/i }));
    await user.keyboard("{Backspace}{Backspace}");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("Enter a complete date.")).toBeInTheDocument();
    expect(screen.queryByText(/Moves this entry to/)).not.toBeInTheDocument();

    await user.keyboard("11");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0].date).toBe("2026-11-01");
  });

  it("says where a changed date moves the entry, with the year when it is not this year", async () => {
    const existing = entry("2026-10-01", "08:00", "09:30", "Northwind", "Existing task");
    const { user } = setup({ mode: "edit", entry: existing, date: existing.date, weekEntries: [existing] });

    expect(screen.queryByText(/Moves this entry to/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("spinbutton", { name: /month/i }));
    await user.keyboard("11052027");

    expect(await screen.findByText(/Moves this entry to Friday, November 5, 2027\./)).toBeInTheDocument();
  });

  it("locks Cancel, Duplicate and Delete while a save is running", () => {
    const existing = entry("2026-10-01", "08:00", "09:30", "Northwind", "Existing task");

    setup({ mode: "edit", entry: existing, date: existing.date, weekEntries: [existing], isSubmitting: true, onCancel: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("does not warn that an entry overlaps itself", () => {
    const existing = entry("2026-10-01", "08:00", "09:30", "Northwind", "Existing task");

    setup({ mode: "edit", entry: existing, date: existing.date, weekEntries: [existing] });

    expect(screen.queryByText(/Overlaps/)).not.toBeInTheDocument();
  });
});
