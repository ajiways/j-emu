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

export type InstanceConfProgress = Readonly<{
  finish: number;
  value: number;
}>;

export type InstanceConfWire = Readonly<{
  artikul_id: string;
  status: 100;
  progress_finish_value?: string;
  progress_value?: number;
}>;

export function instanceConf(
  artikulId: string,
  hasClear: boolean,
  progress: InstanceConfProgress | null = null,
): InstanceConfWire {
  if (!artikulId) throw new Error("Instance artikul is required");
  if (!hasClear) {
    if (progress !== null) {
      throw new Error(`Dungeon ${artikulId} progress bar is not published`);
    }
    return { artikul_id: artikulId, status: 100 };
  }
  if (progress === null) {
    throw new Error(`Dungeon ${artikulId} progress_finish_value is required`);
  }
  if (!Number.isInteger(progress.finish) || progress.finish < 1) {
    throw new Error(`Dungeon ${artikulId} progress_finish_value is invalid`);
  }
  if (!Number.isInteger(progress.value) || progress.value < 0) {
    throw new Error(`Dungeon ${artikulId} progress_value is invalid`);
  }
  if (progress.value > progress.finish) {
    throw new Error(`Dungeon ${artikulId} progress_value exceeds finish`);
  }
  return {
    artikul_id: artikulId,
    progress_finish_value: String(progress.finish),
    progress_value: progress.value,
    status: 100,
  };
}
