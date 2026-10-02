export type ServerErrors = { mapped: Record<string, string>; leftover: string[] };

export function splitServerErrors(fieldErrors: Record<string, string[]>, visible: readonly string[]): ServerErrors {
  const mapped: Record<string, string> = {};
  const leftover: string[] = [];

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const key = field.toLowerCase();
    const message = messages[0];

    if (!message) {
      continue;
    }

    if (visible.includes(key)) {
      mapped[key] = message;
    } else {
      leftover.push(message);
    }
  }

  return { mapped, leftover };
}
