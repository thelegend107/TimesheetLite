import { Tabs } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { useEffect, useRef } from "react";
import { formatWeekdayShort, isoOf } from "../lib/dates";
import { hoursShort } from "../lib/format";

type DayTabsProps = {
  days: CalendarDate[];
  selected: string;
  today: string;
  hours: Map<string, number> | null;
  unavailable?: boolean;
  onSelect: (iso: string) => void;
  children: React.ReactNode;
};

export function DayTabs({ days, selected, today, hours, unavailable = false, onSelect, children }: DayTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedKey = String(days.findIndex((day) => isoOf(day) === selected));

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedKey]);

  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        const day = days[Number(key)];

        if (day) {
          onSelect(isoOf(day));
        }
      }}
    >
      <Tabs.ListContainer>
        <Tabs.List ref={listRef} aria-label="Days of the week" className="h-auto w-full">
          {days.map((day, index) => {
            const iso = isoOf(day);
            const total = hours?.get(iso) ?? 0;

            return (
              <Tabs.Tab key={index} id={String(index)} className="group h-auto min-w-12 flex-1 px-1 py-1.5">
                <span className="flex flex-col items-center gap-0.5 py-0.5 leading-tight">
                  <span className={iso === today ? "text-xs font-semibold" : "text-xs text-muted group-aria-selected:text-foreground"}>{formatWeekdayShort(day)}</span>
                  <span className="flex items-center gap-1 text-sm font-medium tabular-nums">
                    {day.day}
                    {iso === today ? <span aria-label="Today" className="size-1.5 rounded-full bg-accent group-aria-selected:bg-foreground" role="img" /> : null}
                  </span>
                  <span className="text-xs tabular-nums text-muted group-aria-selected:text-foreground">{hours === null ? (unavailable ? "–" : "…") : total > 0 ? `${hoursShort(total)}h` : "–"}</span>
                </span>
                <Tabs.Indicator />
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id={selectedKey} className="px-0 pt-4">
        {children}
      </Tabs.Panel>
    </Tabs>
  );
}
