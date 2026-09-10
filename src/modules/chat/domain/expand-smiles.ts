import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";

export type SmileCatalogEntry = Readonly<{
  tag: string;
  smile: string;
  expire_time: number;
}>;

type SmileMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<{
    tag: string;
    smile: string;
    expire_time: number;
    code: string;
    type: string;
    key_id: string;
    macro_type: "SMILE";
  }>;
}>;

const MAX_SMILES = 3;

export function smileCatalogFromChrome(block: unknown): readonly SmileCatalogEntry[] {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error("user|smiles chrome must be an object");
  }
  const raw = (block as { smiles?: unknown }).smiles;
  if (!Array.isArray(raw)) throw new Error("user|smiles chrome smiles must be an array");
  const entries: SmileCatalogEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("user|smiles chrome row must be an object");
    }
    const record = row as Record<string, unknown>;
    const tag = requiredString(record["tag"], "smile tag");
    const smile = requiredString(record["smile"], "smile swf");
    const expire = record["expire_time"];
    if (expire === undefined || expire === null) {
      throw new Error(`Smile ${tag} expire_time is required`);
    }
    const expire_time = Number(expire);
    if (!Number.isFinite(expire_time) || expire_time < 0) {
      throw new Error(`Smile ${tag} expire_time is invalid`);
    }
    entries.push({ tag, smile, expire_time });
  }
  return [...entries].sort((left, right) => right.tag.length - left.tag.length);
}

export function expandSmileTags(
  text: string,
  catalog: readonly SmileCatalogEntry[],
  macroses: Record<string, unknown>,
): string {
  if (catalog.length === 0 || !text.includes(":")) return text;
  const hits: Array<{ index: number; entry: SmileCatalogEntry }> = [];
  for (const entry of catalog) {
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(entry.tag, from);
      if (index < 0) break;
      hits.push({ index, entry });
      from = index + entry.tag.length;
    }
  }
  if (hits.length === 0) return text;
  hits.sort(
    (left, right) => left.index - right.index || right.entry.tag.length - left.entry.tag.length,
  );
  const chosen: Array<{ index: number; entry: SmileCatalogEntry }> = [];
  const occupied: Array<{ start: number; end: number }> = [];
  for (const hit of hits) {
    if (chosen.length >= MAX_SMILES) break;
    const end = hit.index + hit.entry.tag.length;
    if (occupied.some((range) => hit.index < range.end && end > range.start)) continue;
    chosen.push(hit);
    occupied.push({ start: hit.index, end });
  }
  if (chosen.length === 0) return text;
  chosen.sort((left, right) => right.index - left.index);
  let msg = text;
  const byTag = new Map<string, SmileMacroToken>();
  for (const hit of chosen) {
    let token = byTag.get(hit.entry.tag);
    if (!token) {
      token = buildSmileMacro(hit.entry);
      byTag.set(hit.entry.tag, token);
      macroses[token.key] = token.macro;
    }
    msg = msg.slice(0, hit.index) + token.token + msg.slice(hit.index + hit.entry.tag.length);
  }
  return msg;
}

function buildSmileMacro(entry: SmileCatalogEntry): SmileMacroToken {
  const key = macroKeyId("SMILE", entry.tag);
  const type = entry.smile.replace(/\.swf$/i, "");
  if (!type) throw new Error(`Smile ${entry.tag} type is empty`);
  return {
    key,
    token: `[[SMILE ${key}]]`,
    macro: {
      tag: entry.tag,
      smile: entry.smile,
      expire_time: entry.expire_time,
      code: entry.tag,
      type,
      key_id: key,
      macro_type: "SMILE",
    },
  };
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}
