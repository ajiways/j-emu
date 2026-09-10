export type BookInstanceSnap = Readonly<{
  artikulId: string;
  expiresUnix: number;
}>;

export function bookInstancesWire(
  snaps: readonly BookInstanceSnap[],
  nowUnix: number,
): Readonly<{
  status: 100;
  active: Readonly<Record<string, { artikul_id: string }>>;
  blocked: Readonly<Record<string, { artikul_id: string; dtime: number }>>;
}> {
  if (!Number.isInteger(nowUnix) || nowUnix < 1) {
    throw new Error("Book instances require a positive unix timestamp");
  }
  const ordered = [...snaps].sort((left, right) => left.artikulId.localeCompare(right.artikulId));
  const active: Array<{ artikul_id: string }> = [];
  const blocked: Array<{ artikul_id: string; dtime: number }> = [];
  for (const snap of ordered) {
    if (!snap.artikulId) throw new Error("Book instance artikul id is required");
    if (!Number.isInteger(snap.expiresUnix) || snap.expiresUnix < 1) {
      throw new Error(`Book instance ${snap.artikulId} expiry is missing`);
    }
    if (snap.expiresUnix > nowUnix) active.push({ artikul_id: snap.artikulId });
    else blocked.push({ artikul_id: snap.artikulId, dtime: snap.expiresUnix });
  }
  return { status: 100, active: indexRows(active), blocked: indexRows(blocked) };
}

function indexRows<T>(rows: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  rows.forEach((row, index) => {
    out[String(index)] = row;
  });
  return out;
}
