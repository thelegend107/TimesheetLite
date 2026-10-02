import type { Catalog, Entry } from "../api/types";

const HUES = [175, 200, 285, 305, 325, 345];

function hash(value: string): number {
  let result = 17;

  for (const character of value.toLowerCase()) {
    result = (result * 31 + character.charCodeAt(0)) >>> 0;
  }

  return result;
}

export function projectColor(project: string): string {
  const hue = HUES[hash(project) % HUES.length] ?? 255;

  return `light-dark(oklch(0.58 0.15 ${hue}), oklch(0.76 0.13 ${hue}))`;
}

export function defaultProject(dayEntries: readonly Entry[], catalog: Catalog | undefined): string {
  const lastOfDay = dayEntries.at(-1)?.project;

  if (lastOfDay) {
    return lastOfDay;
  }

  const recent = [...(catalog?.projects ?? [])].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed) || b.uses - a.uses)[0];

  return recent?.name ?? "";
}

export function taskSuggestions(catalog: Catalog | undefined, project: string, query: string, limit = 8): string[] {
  const needle = query.trim().toLowerCase();
  const sameProject = project.trim().toLowerCase();
  const seen = new Set<string>();
  const ranked = [...(catalog?.tasks ?? [])].sort((a, b) => Number(b.project.toLowerCase() === sameProject) - Number(a.project.toLowerCase() === sameProject) || b.uses - a.uses || b.lastUsed.localeCompare(a.lastUsed));
  const result: string[] = [];

  for (const item of ranked) {
    const key = item.task.toLowerCase();

    if (seen.has(key) || (needle !== "" && !key.includes(needle)) || key === needle) {
      continue;
    }

    seen.add(key);
    result.push(item.task);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}
