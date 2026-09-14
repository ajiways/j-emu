import { amfInteger, amfNumber, amfOmittedZeroInteger, amfString, isRecord } from "./amf-fields.ts";
import { idMapToList } from "./id-map-to-list.ts";
import { UNMAPPED_HUNT_FPS, UNMAPPED_HUNT_SCALE, UNMAPPED_HUNT_SPEED } from "./hunt-look-policy.ts";
import type { BotSource } from "./bot-source.ts";

export function botsFromBestiaryAmf(decoded: unknown): BotSource[] {
  if (!isRecord(decoded)) throw new Error("bestiary.amf root must be an object");
  const map = decoded.bots;
  if (!isRecord(map)) throw new Error("bestiary.amf bots map is required");
  const bots: BotSource[] = [];
  const seen = new Set<number>();
  for (const [key, raw] of Object.entries(map)) {
    const bot = botFromAmfRecord(key, raw);
    if (seen.has(bot.id)) throw new Error(`Duplicate bot id ${bot.id} in bestiary.amf`);
    seen.add(bot.id);
    bots.push(bot);
  }
  bots.sort((left, right) => left.id - right.id);
  if (bots.length === 0) throw new Error("bestiary.amf contains no bots");
  return bots;
}

function botFromAmfRecord(mapKey: string, raw: unknown): BotSource {
  if (!isRecord(raw)) throw new Error(`bestiary.amf bot ${mapKey} must be an object`);
  const id = amfInteger(raw.id, `bestiary bot ${mapKey} id`);
  if (id < 1) throw new Error(`bestiary.amf bot ${mapKey} id must be positive`);
  const keyId = amfInteger(mapKey, `bestiary.amf bots key`);
  if (keyId !== id) {
    throw new Error(`bestiary.amf bot key ${mapKey} does not match id ${id}`);
  }
  const title = amfString(raw.nick, `bestiary bot ${id} nick`);
  if (!title) throw new Error(`bestiary bot ${id} nick is required`);
  const level = amfInteger(raw.level, `bestiary bot ${id} level`);
  if (level < 1) throw new Error(`bestiary bot ${id} level must be positive`);
  const skills = isRecord(raw.skills) ? raw.skills : {};
  const strength = amfOmittedZeroInteger(skills.STR, `bestiary bot ${id} STR`);
  const maxHp = amfOmittedZeroInteger(skills.VIT, `bestiary bot ${id} VIT`);
  if (maxHp < 1) throw new Error(`bestiary bot ${id} VIT must be positive`);
  const sk = amfString(raw.sk, `bestiary bot ${id} sk`);
  const avatar = amfString(raw.avatar, `bestiary bot ${id} avatar`);
  const body = amfString(raw.body, `bestiary bot ${id} body`);
  const kind = amfOmittedZeroInteger(raw.kind, `bestiary bot ${id} kind`);
  if (kind < 0) throw new Error(`bestiary bot ${id} kind must be >= 0`);
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
    ultrabeast: amfOmittedZeroInteger(raw.ultrabeast, `bestiary bot ${id} ultrabeast`),
    baseExp: amfOmittedZeroInteger(raw.base_exp, `bestiary bot ${id} base_exp`),
    moneyMin: amfNumber(raw.money_min, `bestiary bot ${id} money_min`),
    moneyMax: amfNumber(raw.money_max, `bestiary bot ${id} money_max`),
    dropIds: idMapToList(raw.drop, `bestiary bot ${id} drop`),
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
    provenance: "amf",
  };
}
