export function travelFtime(ftimeMax: number, speed: number): number {
  if (!Number.isInteger(ftimeMax) || ftimeMax < 0) {
    throw new Error("ftimeMax must be a non-negative integer");
  }
  if (!Number.isInteger(speed) || speed < 0 || speed > 100) {
    throw new Error("SPEED must be an integer in [0, 100]");
  }
  return Math.floor((ftimeMax * (100 - speed)) / 100);
}

export function travelLockActive(moveReadyAt: Date | null, now: Date): boolean {
  requireTimestamp(now, "clock now");
  if (moveReadyAt === null) return false;
  requireTimestamp(moveReadyAt, "move_ready_at");
  return moveReadyAt.getTime() > now.getTime();
}

export function remainingAreaFtime(moveReadyAt: Date | null, now: Date): number {
  requireTimestamp(now, "clock now");
  if (moveReadyAt === null) return 0;
  requireTimestamp(moveReadyAt, "move_ready_at");
  const remainingMs = moveReadyAt.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  return Math.floor(remainingMs / 1000);
}

export function waitLockSeconds(moveReadyAt: Date, now: Date): number {
  requireTimestamp(moveReadyAt, "move_ready_at");
  requireTimestamp(now, "clock now");
  const remaining = (moveReadyAt.getTime() - now.getTime()) / 1000;
  if (remaining <= 0) throw new Error("Travel lock has already expired");
  return Math.max(1, Math.ceil(remaining));
}

export function waitLockError(seconds: number): string {
  if (!Number.isInteger(seconds) || seconds < 1) {
    throw new Error("Wait lock seconds must be a positive integer");
  }
  return `Подождите! Дальнейшее перемещение станет возможным по истечении ${seconds}&nbsp;с..`;
}

export function addTravelSeconds(now: Date, seconds: number): Date {
  requireTimestamp(now, "clock now");
  if (!Number.isInteger(seconds) || seconds < 1) {
    throw new Error("Travel lock seconds must be a positive integer");
  }
  return new Date(now.getTime() + seconds * 1000);
}

function requireTimestamp(value: Date, label: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${label} is invalid`);
  }
}
