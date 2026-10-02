import type { CalendarDate } from "@internationalized/date";
import { useCallback, useState } from "react";
import { isoOf, todayDate, tryParseIso } from "./dates";

const PARAM = "d";

export function useSelectedDate() {
  const [selected, setSelected] = useState<CalendarDate>(() => tryParseIso(new URLSearchParams(window.location.search).get(PARAM)) ?? todayDate());

  const select = useCallback((date: CalendarDate) => {
    setSelected(date);

    const url = new URL(window.location.href);

    if (isoOf(date) === isoOf(todayDate())) {
      url.searchParams.delete(PARAM);
    } else {
      url.searchParams.set(PARAM, isoOf(date));
    }

    window.history.replaceState(null, "", url);
  }, []);

  return [selected, select] as const;
}
