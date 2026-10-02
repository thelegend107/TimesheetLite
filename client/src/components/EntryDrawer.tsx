import { Drawer } from "@heroui/react";
import type { Catalog, Entry, EntryInput } from "../api/types";
import { EntryForm } from "./EntryForm";

type EntryDrawerProps = {
  entry: Entry | null;
  isOpen: boolean;
  isSubmitting: boolean;
  weekEntries: Entry[];
  catalog: Catalog | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: EntryInput) => Promise<void>;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function EntryDrawer({ entry, isOpen, isSubmitting, weekEntries, catalog, onOpenChange, onSubmit, onDuplicate, onDelete }: EntryDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-label="Edit entry" className="w-full sm:max-w-md">
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>Edit entry</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            {entry ? <EntryForm key={entry.id} catalog={catalog} date={entry.date} entry={entry} isSubmitting={isSubmitting} mode="edit" weekEntries={weekEntries} onCancel={() => onOpenChange(false)} onDelete={onDelete} onDuplicate={onDuplicate} onSubmit={onSubmit} /> : null}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
