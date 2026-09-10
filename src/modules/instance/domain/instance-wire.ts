export function formatDurationHours(sec: number): string {
  if (!Number.isInteger(sec) || sec < 1) {
    throw new Error("Instance duration seconds must be a positive integer");
  }
  const hours = Math.max(1, Math.round(sec / 3600));
  if (hours === 1) return "1 час";
  if (hours < 5) return `${hours} часа`;
  return `${hours} часов`;
}

export function instanceCreatedChat(title: string, durationSec: number): string {
  if (!title) throw new Error("Instance title is required");
  return `Создан инстанс подземелья «${title}». Он будет активен ${formatDurationHours(durationSec)}.`;
}

export function instanceConf(
  artikulId: string,
  hasClear: boolean,
): Readonly<{
  artikul_id: string;
  status: 100;
}> {
  if (!artikulId) throw new Error("Instance artikul is required");
  if (hasClear) {
    throw new Error(`Dungeon ${artikulId} progress bar is outside this slice`);
  }
  return { artikul_id: artikulId, status: 100 };
}
