export function remainingSec(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

export function formatRtime(sec: number): Readonly<{ rtime: string; rtime_num: number }> {
  const h = Math.max(0, Math.ceil(sec / 3600));
  const rtime = h >= 8 ? "Много" : h >= 2 ? "Средне" : "Мало";
  return { rtime, rtime_num: h };
}
