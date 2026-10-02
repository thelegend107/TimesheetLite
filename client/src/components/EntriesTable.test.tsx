import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Entry } from "../api/types";
import { EntriesTable } from "./EntriesTable";

const entry = (id: number, task: string): Entry => ({ id, date: "2026-10-02", project: "Contoso", task, start: "08:00", end: "09:00", hours: 1, notes: null, createdAt: "2026-10-02T12:00:00+00:00", updatedAt: "2026-10-02T12:00:00+00:00" });

const show = (highlightId: number | null) => render(<EntriesTable dayLabel="Friday, October 2" entries={[entry(1, "First task"), entry(2, "Second task")]} highlightId={highlightId} isLoading={false} onDelete={vi.fn()} onDuplicate={vi.fn()} onEdit={vi.fn()} />);

describe("EntriesTable", () => {
  it("marks only the row that was just added", () => {
    show(2);

    const rowOf = (task: string) => screen.getByText(task).closest("tr");

    expect(rowOf("Second task")).toHaveClass("entry-added");
    expect(rowOf("First task")).not.toHaveClass("entry-added");
  });

  it("moves the mark when the highlight changes and clears it afterwards", () => {
    const entries = [entry(1, "First task"), entry(2, "Second task")];
    const table = (highlightId: number | null) => <EntriesTable dayLabel="Friday, October 2" entries={entries} highlightId={highlightId} isLoading={false} onDelete={vi.fn()} onDuplicate={vi.fn()} onEdit={vi.fn()} />;
    const view = render(table(null));

    view.rerender(table(1));
    expect(screen.getByText("First task").closest("tr")).toHaveClass("entry-added");

    view.rerender(table(null));
    expect(document.querySelector(".entry-added")).toBeNull();
  });

  it("marks nothing when no entry was just added", () => {
    show(null);

    expect(document.querySelector(".entry-added")).toBeNull();
  });

  it("wraps long unbroken text instead of widening the table", () => {
    render(<EntriesTable dayLabel="Friday, October 2" entries={[entry(3, "T".repeat(100))]} isLoading={false} onDelete={vi.fn()} onDuplicate={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("T".repeat(100))).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("drops the totals footer for an empty day", () => {
    render(<EntriesTable dayLabel="Friday, October 2" entries={[]} isLoading={false} onDelete={vi.fn()} onDuplicate={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByText("No time logged for this day yet.")).toBeInTheDocument();
    expect(screen.queryByText(/entries$/)).not.toBeInTheDocument();
  });
});
