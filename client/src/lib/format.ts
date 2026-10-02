export function hoursFixed(hours: number): string {
  return hours.toFixed(2);
}

export function hoursShort(hours: number): string {
  return String(Math.round(hours * 100) / 100);
}

export function sumHours(values: Iterable<number>): number {
  let cents = 0;

  for (const value of values) {
    cents += Math.round(value * 100);
  }

  return cents / 100;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
