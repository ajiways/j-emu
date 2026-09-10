import { ProtocolError } from "../../application/protocol-error.ts";

export function stringField(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

export function enclosedGold(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ProtocolError(203, "Укажите сумму");
  return n;
}

export function parseMailAttachments(
  raw: unknown,
): readonly Readonly<{ itemId: number; quantity: number }>[] {
  if (!raw || typeof raw !== "object") return [];
  const entries = Array.isArray(raw)
    ? raw.map((value, index) => [String(index), value] as const)
    : Object.entries(raw as Record<string, unknown>);
  const out: Array<{ itemId: number; quantity: number }> = [];
  for (const [key, value] of entries) {
    const itemId = Number(key);
    const quantity = Math.floor(Number(value));
    if (itemId > 0 && Number.isInteger(quantity) && quantity > 0) {
      out.push({ itemId, quantity });
    }
  }
  return out;
}

export function parseMailIds(raw: unknown): number[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) return raw.map(Number).filter((id) => id > 0);
  if (typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>)
      .map(Number)
      .filter((id) => id > 0);
  }
  const id = Number(raw);
  return id > 0 ? [id] : [];
}

export function truthyMailField(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value === undefined || value === null ? "" : value)
    .trim()
    .toLowerCase();
  return s === "1" || s === "true";
}
