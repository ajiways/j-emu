export function parseGiveItems(raw: unknown): Map<number, number> {
  const out = new Map<number, number>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    const qty = Math.floor(Number(value));
    if (Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0) out.set(id, qty);
  }
  return out;
}

export function normalizeNickList(nick: unknown): readonly string[] {
  if (Array.isArray(nick)) {
    return nick
      .map(String)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (nick != null && String(nick).trim()) return [String(nick).trim()];
  return [];
}
