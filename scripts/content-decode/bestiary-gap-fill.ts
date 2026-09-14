import { amfInteger, amfNumber, amfOmittedZeroInteger, isRecord } from "./amf-fields.ts";
import type { BotSource } from "./bot-source.ts";
import { UNMAPPED_HUNT_FPS, UNMAPPED_HUNT_SCALE, UNMAPPED_HUNT_SPEED } from "./hunt-look-policy.ts";
import { idMapToList } from "./id-map-to-list.ts";

export function botsFromGapFill(decoded: unknown, existingIds: ReadonlySet<number>): BotSource[] {
  if (!isRecord(decoded)) throw new Error("bestiary-bots.json root must be an object");
  const map = decoded.bots;
  if (!isRecord(map)) throw new Error("bestiary-bots.json bots map is required");
  const extra: BotSource[] = [];
  const seen = new Set<number>();
  for (const [key, raw] of Object.entries(map)) {
    if (!isRecord(raw)) throw new Error(`bestiary-bots.json bot ${key} must be an object`);
    const id = amfInteger(raw.id ?? key, `bestiary-bots.json bot ${key} id`);
    if (id < 1) throw new Error(`bestiary-bots.json bot ${key} id must be positive`);
    if (seen.has(id)) throw new Error(`Duplicate bot id ${id} in bestiary-bots.json`);
    seen.add(id);
    if (existingIds.has(id)) continue;
    extra.push(botFromGapRecord(id, raw));
  }
  extra.sort((left, right) => left.id - right.id);
  return extra;
}

function botFromGapRecord(id: number, raw: Record<string, unknown>): BotSource {
  const title = stringField(raw.nick, `bestiary-bots.json bot ${id} nick`);
  if (!title) throw new Error(`bestiary-bots.json bot ${id} nick is required`);
  const level = amfInteger(raw.level, `bestiary-bots.json bot ${id} level`);
  if (level < 1) throw new Error(`bestiary-bots.json bot ${id} level must be positive`);
  const skills = isRecord(raw.skills) ? raw.skills : {};
  const strength = amfOmittedZeroInteger(raw.str ?? skills.STR, `bestiary-bots.json bot ${id} STR`);
  const maxHp = amfOmittedZeroInteger(raw.vit ?? skills.VIT, `bestiary-bots.json bot ${id} VIT`);
  if (maxHp < 1) throw new Error(`bestiary-bots.json bot ${id} VIT must be positive`);
  const sk = stringField(raw.sk, `bestiary-bots.json bot ${id} sk`);
  const avatar = stringField(raw.avatar, `bestiary-bots.json bot ${id} avatar`);
  const body = stringField(raw.body, `bestiary-bots.json bot ${id} body`);
  const kind = amfOmittedZeroInteger(raw.kind, `bestiary-bots.json bot ${id} kind`);
  return {
    id,
    title,
    level,
    maxHp,
    strength,
    sk,
    avatar,
    body,
    kind,
    ultrabeast: amfOmittedZeroInteger(raw.ultrabeast, `bestiary-bots.json bot ${id} ultrabeast`),
    baseExp: amfOmittedZeroInteger(
      raw.base_exp ?? raw.baseExp,
      `bestiary-bots.json bot ${id} base_exp`,
    ),
    moneyMin: amfNumber(raw.money_min ?? raw.moneyMin, `bestiary-bots.json bot ${id} money_min`),
    moneyMax: amfNumber(raw.money_max ?? raw.moneyMax, `bestiary-bots.json bot ${id} money_max`),
    dropIds: idMapToList(raw.drop_artikul_ids ?? raw.drop, `bestiary-bots.json bot ${id} drop`),
    hunt: {
      nick: title,
      swf: "",
      scale: UNMAPPED_HUNT_SCALE,
      fps: UNMAPPED_HUNT_FPS,
      speed: UNMAPPED_HUNT_SPEED,
      avatar,
      kind,
      hideOnMap: 0,
      sk,
      body,
    },
    provenance: "gap-fill",
  };
}

function stringField(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}
