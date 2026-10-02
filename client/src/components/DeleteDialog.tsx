import { AlertDialog, Button } from "@heroui/react";
import type { Entry } from "../api/types";
import { endMinutesOf, startMinutesOf } from "../lib/entries";
import { hoursFixed } from "../lib/format";
import { formatRange } from "../lib/time";

type DeleteDialogProps = { entry: Entry | null; isOpen: boolean; isPending: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void };

export function DeleteDialog({ entry, isOpen, isPending, onOpenChange, onConfirm }: DeleteDialogProps) {
  const start = entry ? startMinutesOf(entry) : null;
  const end = entry ? endMinutesOf(entry) : null;

  return (
    <AlertDialog.Backdrop isKeyboardDismissDisabled={isPending} isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-describedby={entry ? "delete-entry-warning" : undefined}>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete this entry?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            {entry ? (
              <div className="flex flex-col gap-2">
                <p className="font-medium [overflow-wrap:anywhere]">{entry.task}</p>
                <p className="text-sm tabular-nums text-muted [overflow-wrap:anywhere]">
                  {entry.project} · {start !== null && end !== null ? formatRange(start, end) : "No times"} · {hoursFixed(entry.hours)} h
                </p>
                <p className="text-sm text-muted" id="delete-entry-warning">{start !== null && end !== null ? "You can undo this for a few seconds afterwards." : "This cannot be undone."} If it was pushed to Clockify, it is removed there the next time you push this week.</p>
              </div>
            ) : null}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button isDisabled={isPending} slot="close" variant="tertiary">
              Keep entry
            </Button>
            <Button isPending={isPending} variant="danger" onPress={onConfirm}>
              Delete entry
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
