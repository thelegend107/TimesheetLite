import { toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { entriesQuery, useCatalog, useConfig, useEntries } from "./api/queries";
import { AppHeader } from "./components/AppHeader";
import { ClockifyDialog } from "./components/ClockifyDialog";
import { DayTabs } from "./components/DayTabs";
import { DayWorkspace } from "./components/DayWorkspace";
import { ExportDialog } from "./components/ExportDialog";
import { WeekBar } from "./components/WeekBar";
import { isoOf, todayDate, weekDays, weekStartOf } from "./lib/dates";
import { hoursByDay, summarizeWeek } from "./lib/entries";
import { hoursShort } from "./lib/format";
import { newWeekGoalState, shouldAnnounceWeek } from "./lib/weekGoal";
import { useTheme } from "./lib/theme";
import { useSelectedDate } from "./lib/useSelectedDate";

const DEFAULT_TARGET = 40;

export function App() {
  const theme = useTheme();
  const client = useQueryClient();
  const [selected, select] = useSelectedDate();
  const [exportOpen, setExportOpen] = useState(false);
  const [clockifyOpen, setClockifyOpen] = useState(false);

  const weekStart = weekStartOf(selected);
  const days = weekDays(weekStart);
  const from = isoOf(weekStart);
  const to = isoOf(weekStart.add({ days: 6 }));
  const entries = useEntries(from, to);
  const catalog = useCatalog();
  const config = useConfig();

  useEffect(() => {
    const start = weekStartOf(selected);

    for (const offset of [-7, 7]) {
      const other = start.add({ days: offset });

      void client.prefetchQuery(entriesQuery(isoOf(other), isoOf(other.add({ days: 6 }))));
    }
  }, [client, selected]);

  const data = entries.data;
  const summary = data ? summarizeWeek(data, days.map(isoOf)) : null;
  const target = config.data?.weeklyTargetHours ?? DEFAULT_TARGET;
  const goal = useRef(newWeekGoalState());

  const weekTotal = summary ? summary.total : null;

  useEffect(() => {
    const total = weekTotal;

    if (total === null) {
      return;
    }

    if (shouldAnnounceWeek(goal.current, from, total, target, Date.now())) {
      toast.success("Week complete", { description: `${hoursShort(total)} of ${hoursShort(target)} h logged.` });
    }
  }, [from, weekTotal, target]);

  const projects = (catalog.data?.projects ?? []).map((project) => project.name);

  return (
    <div className="min-h-dvh">
      <AppHeader preference={theme.preference} resolved={theme.resolved} onClockify={() => setClockifyOpen(true)} onExport={() => setExportOpen(true)} onThemeChange={theme.setPreference} />
      <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 px-4 py-4 sm:px-6">
        <WeekBar
          selected={selected}
          target={target}
          total={summary ? summary.total : null}
          unavailable={entries.isError}
          weekStart={weekStart}
          onPick={select}
          onShiftWeek={(delta) => select(selected.add({ days: delta * 7 }))}
          onToday={() => select(todayDate())}
        />
        <DayTabs days={days} hours={data ? hoursByDay(data) : null} selected={isoOf(selected)} today={isoOf(todayDate())} unavailable={entries.isError} onSelect={(iso) => select(days.find((day) => isoOf(day) === iso) ?? selected)}>
          <DayWorkspace onUserChange={() => { goal.current.userActionAt = Date.now(); }} catalog={catalog.data} date={isoOf(selected)} days={days} error={entries.error} isLoading={entries.isPending} summary={summary} weekEntries={data} onRetry={() => void entries.refetch()} />
        </DayTabs>
      </main>
      <ExportDialog isOpen={exportOpen} projects={projects} selected={selected} onOpenChange={setExportOpen} />
      <ClockifyDialog isOpen={clockifyOpen} selected={selected} onOpenChange={setClockifyOpen} />
    </div>
  );
}
