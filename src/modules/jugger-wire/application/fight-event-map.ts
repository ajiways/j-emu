export function fightEventMap(
  events: readonly Readonly<Record<string, unknown>>[],
): Readonly<{ ev: Readonly<Record<string, Readonly<Record<string, unknown>>>> }> {
  if (events.length === 0) throw new Error("Fight event map requires at least one event");
  const ev: Record<string, Readonly<Record<string, unknown>>> = {};
  events.forEach((event, index) => {
    ev[String(index + 1)] = event;
  });
  return { ev };
}
