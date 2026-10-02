import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Entry } from "../api/types";
import { DeleteDialog } from "./DeleteDialog";

const entry: Entry = { id: 7, date: "2026-10-02", project: "Contoso", task: "Standup", start: "08:00", end: "09:00", hours: 1, notes: null, createdAt: "2026-10-02T12:00:00+00:00", updatedAt: "2026-10-02T12:00:00+00:00" };

function setup(isPending: boolean) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  render(<DeleteDialog entry={entry} isOpen isPending={isPending} onConfirm={onConfirm} onOpenChange={onOpenChange} />);

  return { onOpenChange, onConfirm, user: userEvent.setup() };
}

describe("DeleteDialog", () => {
  it("closes on Escape and on Keep entry when nothing is pending", async () => {
    const { onOpenChange, user } = setup(false);

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open while the delete is running", async () => {
    const { onOpenChange, user } = setup(true);

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Keep entry" }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Keep entry" })).toBeDisabled();
  });

  it("describes the dialog with the warning text", () => {
    setup(false);

    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(/undo this for a few seconds/);
  });
});
