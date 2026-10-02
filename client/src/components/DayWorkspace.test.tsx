import { I18nProvider, Toast } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { parseIso, weekDays } from "../lib/dates";
import { DayWorkspace } from "./DayWorkspace";

const days = weekDays(parseIso("2026-09-28"));

function setup(props: Partial<React.ComponentProps<typeof DayWorkspace>>) {
  return render(
    <I18nProvider locale="en-US">
      <QueryClientProvider client={new QueryClient()}>
        <Toast.Provider />
        <DayWorkspace catalog={undefined} date="2026-10-02" days={days} error={null} isLoading={false} summary={null} weekEntries={[]} onRetry={vi.fn()} onUserChange={vi.fn()} {...props} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("DayWorkspace", () => {
  it("shows only the error when the week could not be loaded", () => {
    setup({ error: new Error("The server could not be reached."), weekEntries: undefined });

    expect(screen.getByText("Entries could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No time logged for this day yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Week by project")).not.toBeInTheDocument();
  });

  it("keeps showing the week when a refresh fails after a successful load", () => {
    setup({ error: new Error("The server could not be reached."), weekEntries: [] });

    expect(screen.getByText("Entries could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("No time logged for this day yet.")).toBeInTheDocument();
  });

  it("does not total an empty day", () => {
    setup({});

    expect(screen.getByText("No time logged for this day yet.")).toBeInTheDocument();
    expect(screen.queryByText("0 entries")).not.toBeInTheDocument();
  });

  it("offers Undo after a delete and puts the entry back", async () => {
    const entry = { id: 5, date: "2026-10-02", project: "Contoso", task: "Standup", start: "08:00", end: "09:00", hours: 1, notes: "kept", createdAt: "x", updatedAt: "x" };
    const calls: string[] = [];
    const bodies: unknown[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(url)}`);

      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      if (init?.method === "POST") {
        bodies.push(JSON.parse(String(init.body)));

        return new Response(JSON.stringify({ ...entry, id: 6 }), { status: 201, headers: { "Content-Type": "application/json" } });
      }

      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const user = userEvent.setup();

    setup({ weekEntries: [entry] });
    await user.click(screen.getByRole("button", { name: "Actions for Standup" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete entry" }));
    await user.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ date: "2026-10-02", project: "Contoso", task: "Standup", start: "08:00", end: "09:00", notes: "kept" });
    expect(calls.some((call) => call.startsWith("DELETE"))).toBe(true);
  });
});
