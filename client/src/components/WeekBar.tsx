import { Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight } from "@gravity-ui/icons";
import { Button, ButtonGroup, Meter, Popover, Skeleton } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { useState } from "react";
import { formatWeekRange } from "../lib/dates";
import { hoursShort } from "../lib/format";
import { CalendarPanel } from "./CalendarPanel";

type WeekBarProps = {
  weekStart: CalendarDate;
  selected: CalendarDate;
  total: number | null;
  unavailable?: boolean;
  target: number;
  onShiftWeek: (delta: number) => void;
  onToday: () => void;
  onPick: (date: CalendarDate) => void;
};

export function WeekBar({ weekStart, selected, total, unavailable = false, target, onShiftWeek, onToday, onPick }: WeekBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const over = total !== null && total > target ? total - target : 0;

  return (
    <section aria-label="Week" className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-2">
        <ButtonGroup size="sm" variant="tertiary">
          <Button isIconOnly aria-label="Previous week" className="max-md:min-h-11 max-md:min-w-11" onPress={() => onShiftWeek(-1)}>
            <ChevronLeft />
          </Button>
          <Button className="max-md:min-h-11" onPress={onToday}>
            <ButtonGroup.Separator />
            Today
          </Button>
          <Button isIconOnly aria-label="Next week" className="max-md:min-h-11 max-md:min-w-11" onPress={() => onShiftWeek(1)}>
            <ButtonGroup.Separator />
            <ChevronRight />
          </Button>
        </ButtonGroup>
        <Popover isOpen={pickerOpen} onOpenChange={setPickerOpen}>
          <Button isIconOnly aria-label="Pick a date" className="max-md:min-h-11 max-md:min-w-11" size="sm" variant="tertiary">
            <CalendarIcon />
          </Button>
          <Popover.Content placement="bottom start">
            <Popover.Dialog aria-label="Pick a date">
              <CalendarPanel
                aria-label="Pick a date"
                value={selected}
                onChange={(date) => {
                  onPick(date);
                  setPickerOpen(false);
                }}
              />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>

      <h2 className="text-lg font-semibold tabular-nums">{formatWeekRange(weekStart)}</h2>

      <div className="ml-auto flex w-full min-w-56 flex-col gap-1 sm:w-64">
        {total === null ? (
          unavailable ? (
            <span className="text-end text-sm text-muted">Week total unavailable</span>
          ) : (
            <Skeleton className="h-8 w-full rounded-lg" />
          )
        ) : (
          <Meter aria-label="Hours this week" color="default" maxValue={target} size="sm" value={Math.min(total, target)} valueLabel={`${hoursShort(total)} of ${hoursShort(target)} h`}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-1.5">
                {total >= target ? <Check aria-hidden className="size-3.5" /> : null}
                <Meter.Output className="font-medium tabular-nums" />
              </span>
              {over > 0 ? <span className="text-xs text-muted tabular-nums">+{hoursShort(over)} h over</span> : null}
            </div>
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
        )}
      </div>
    </section>
  );
}
