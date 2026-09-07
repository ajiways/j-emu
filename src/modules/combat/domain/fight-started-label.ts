/** Wire `started` label from the old `formatFightStarted` (`dd.MM HH:mm`). */
export function fightStartedLabel(at: Date): string {
  const day = String(at.getDate()).padStart(2, "0");
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const hour = String(at.getHours()).padStart(2, "0");
  const minute = String(at.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hour}:${minute}`;
}
