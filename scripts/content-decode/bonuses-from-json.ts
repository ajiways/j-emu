import type { BonusDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import {
  isRecord,
  rejectUnknownKeys,
  requireInteger,
  requireNonemptyString,
  requireString,
} from "./json-object-keys.ts";

const ROOT_KEYS = new Set(["_note", "bonuses"]);
const BONUS_KEYS = new Set([
  "id",
  "kind",
  "skillId",
  "delta",
  "needValue",
  "artikulId",
  "title",
  "chatMsg",
]);

export function bonusesFromJson(raw: unknown): BonusDocument[] {
  if (!isRecord(raw)) throw new Error("bonuses root must be an object");
  rejectUnknownKeys(raw, ROOT_KEYS, "bonuses");
  requireString(raw._note, "bonuses _note");
  if (!Array.isArray(raw.bonuses)) throw new Error("bonuses.bonuses must be an array");
  const bonuses: BonusDocument[] = [];
  const seen = new Set<number>();
  for (const row of raw.bonuses) {
    if (!isRecord(row)) throw new Error("bonus must be an object");
    rejectUnknownKeys(row, BONUS_KEYS, "bonus");
    const id = requireInteger(row.id, "bonus id");
    if (id < 1) throw new Error("bonus id must be positive");
    if (seen.has(id)) throw new Error(`Duplicate bonus ${id}`);
    seen.add(id);
    if (row.kind !== "skill")
      throw new Error(`bonus ${id} kind ${String(row.kind)} is not supported`);
    const delta = requireInteger(row.delta, `bonus ${id} delta`);
    if (delta === 0) throw new Error(`bonus ${id} delta must be non-zero`);
    const needValue = requireInteger(row.needValue, `bonus ${id} needValue`);
    if (needValue < 0) throw new Error(`bonus ${id} needValue is invalid`);
    const artikulId = requireInteger(row.artikulId, `bonus ${id} artikulId`);
    if (artikulId < 1) throw new Error(`bonus ${id} artikulId must be positive`);
    bonuses.push({
      id,
      kind: "skill",
      skillId: requireNonemptyString(row.skillId, `bonus ${id} skillId`),
      delta,
      needValue,
      artikulId,
      title: requireNonemptyString(row.title, `bonus ${id} title`),
      chatMsg: requireString(row.chatMsg, `bonus ${id} chatMsg`),
    });
  }
  if (!bonuses.some((bonus) => bonus.id === 601)) throw new Error("bonus 601 is required");
  return bonuses;
}
