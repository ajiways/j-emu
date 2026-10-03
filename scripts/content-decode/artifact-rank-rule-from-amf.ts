import { isRecord } from "./amf-fields.ts";

export type DecodedRankRule = Readonly<{ rank: number; buy: boolean; wear: boolean }>;

const RANK_IMAGE = /images\/ranks\/(\d+)\.png/;
const BUYING = /покуп|доступн/i;
const WEARING = /нош|надеван|пользоват|доступн/i;
/** A rank named only in the flavor text, not as a condition of the item. */
const FLAVOR = /награда/i;

/**
 * The «Ограничения» line of a card names the rank as an image macro right after its condition
 * («Для покупки и ношения необходимо достичь звания [[IMG …]]»). The client carries no other field
 * for it, so the line is the source; a line that fits no known wording stops the decode.
 */
export function decodeRankRule(raw: unknown, artifactId: number): DecodedRankRule | undefined {
  if (!isRecord(raw) || typeof raw.text !== "string" || !isRecord(raw.macroses)) return undefined;
  const ranks = Object.entries(raw.macroses).flatMap(([key, macro]) => {
    const match = isRecord(macro) ? RANK_IMAGE.exec(String(macro.src)) : null;
    return match?.[1] ? [{ key, rank: Number(match[1]) }] : [];
  });
  if (ranks.length === 0) return undefined;
  const [only] = ranks;
  if (ranks.length > 1 || !only) {
    throw new Error(`artifact ${artifactId} description names several ranks`);
  }
  const at = raw.text.indexOf(`[[IMG ${only.key}]]`);
  if (at < 0) throw new Error(`artifact ${artifactId} rank macro ${only.key} is not in the text`);
  const line = raw.text
    .slice(0, at)
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[[^\]]*\]\]/g, "#")
    .split("•")
    .pop();
  if (line === undefined) throw new Error(`artifact ${artifactId} rank line is empty`);
  if (FLAVOR.test(line)) return undefined;
  const buy = BUYING.test(line);
  const wear = WEARING.test(line);
  if (!buy && !wear) {
    throw new Error(`artifact ${artifactId} rank line has an unknown wording: ${line.trim()}`);
  }
  return { rank: only.rank, buy, wear };
}
