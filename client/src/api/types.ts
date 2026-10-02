export type Entry = {
  id: number;
  date: string;
  project: string;
  task: string;
  start: string | null;
  end: string | null;
  hours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntryInput = {
  date: string;
  project: string;
  task: string;
  start: string;
  end: string;
  notes: string | null;
};

export type ProjectUsage = { name: string; uses: number; lastUsed: string };

export type TaskUsage = { project: string; task: string; uses: number; lastUsed: string };

export type Catalog = { projects: ProjectUsage[]; tasks: TaskUsage[] };

export type AppConfig = { weeklyTargetHours: number; clockifyConfigured: boolean };

export type ClockifyIssue = "None" | "NotConfigured" | "SchemaMissing" | "Unreadable" | "Unauthorized" | "Unreachable";

export type ClockifyMappingSource = "None" | "Saved" | "Name";

export type ClockifyConnectionSource = "None" | "App" | "Environment";

export type ClockifySyncAction = "Create" | "Update" | "Delete" | "Link" | "Unchanged" | "Blocked";

export type ClockifySyncOutcome = "Planned" | "Done" | "Failed" | "Skipped";

export type ClockifyAccount = { userName: string; email: string; workspaceId: string; workspaceName: string; timeZone: string };

export type ClockifyProject = { id: string; name: string; clientName: string };

export type ClockifyRule = { project: string; phrase: string; clockifyProjectId: string; billable: boolean | null };

export type ClockifyMapping = { project: string; clockifyProjectId: string | null; source: ClockifyMappingSource };

export type ClockifyStatus = {
  issue: ClockifyIssue;
  message: string | null;
  account: ClockifyAccount | null;
  projects: ClockifyProject[];
  mappings: ClockifyMapping[];
  rules: ClockifyRule[];
  connection: ClockifyConnectionSource;
};

export type ClockifySyncRequest = {
  from: string;
  to: string;
  includeNotes: boolean;
  apply: boolean;
  mappings: Record<string, string>;
  rules: ClockifyRule[];
};

export type ClockifySyncItem = {
  entryId: number | null;
  date: string;
  start: string | null;
  end: string | null;
  label: string;
  description: string;
  action: ClockifySyncAction;
  outcome: ClockifySyncOutcome;
  message: string | null;
  destination: string | null;
  billable: boolean | null;
};

export type ClockifySyncSummary = { create: number; update: number; delete: number; link: number; unchanged: number; blocked: number; failed: number };

export type ClockifySyncResult = { applied: boolean; summary: ClockifySyncSummary; items: ClockifySyncItem[] };
