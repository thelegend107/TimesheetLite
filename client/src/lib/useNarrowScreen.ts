import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639px)";

const subscribe = (notify: () => void) => {
  const list = window.matchMedia(QUERY);

  list.addEventListener("change", notify);

  return () => list.removeEventListener("change", notify);
};

export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
