import { amfInteger, amfNumber, amfOmittedZeroInteger, isRecord } from "./amf-fields.ts";
import type { BotHuntLook, BotSource } from "./bot-source.ts";
import { UNMAPPED_HUNT_FPS, UNMAPPED_HUNT_SCALE, UNMAPPED_HUNT_SPEED } from "./hunt-look-policy.ts";
import { idMapToList } from "./id-map-to-list.ts";

type OverlayLoot = Readonly<{
  dropCnt: number;
  bonusChance: number;
  bonusMin: number;
  bonusMax: number;
  nothingWeight: number | null;
  entries: readonly OverlayLootEntry[];
}>;

type OverlayLootEntry = Readonly<{
  artikulId: number;
  dropWeight: number;
  countMin: number;
  countMax: number;
}>;

export type OverlayBot = Readonly<{
  id: number;
  nick: string;
  level: number;
  sk: string;
  avatar: string;
  body: string;
  kind: number;
  ultrabeast: number;
  baseExp: number;
  moneyMin: number;
  moneyMax: number;
  strength: number;
  maxHp: number;
  dropIds: readonly number[];
  hunt: BotHuntLook | null;
  loot: OverlayLoot | null;
}>;

export function loadOverlayBots(decoded: unknown): OverlayBot[] {
  if (!isRecord(decoded)) throw new Error("bots-overlay.json root must be an object");
  const map = decoded.bots;
  if (!isRecord(map)) throw new Error("bots-overlay.json bots map is required");
  const bots: OverlayBot[] = [];
  const seen = new Set<number>();
  for (const [key, raw] of Object.entries(map)) {
    const bot = overlayBotFromRecord(key, raw);
    if (seen.has(bot.id)) throw new Error(`Duplicate bot id ${bot.id} in bots-overlay.json`);
    seen.add(bot.id);
    bots.push(bot);
  }
  return bots;
}

export function applyBotOverlay(
  base: readonly BotSource[],
  overlay: readonly OverlayBot[],
): BotSource[] {
  const byId = new Map(base.map((bot) => [bot.id, bot]));
  for (const row of overlay) {
    const previous = byId.get(row.id);
    byId.set(row.id, overlayToSource(row, previous));
  }
  return [...byId.values()].sort((left, right) => left.id - right.id);
}

function overlayToSource(row: OverlayBot, previous: BotSource | undefined): BotSource {
  const title = previous?.title ?? row.nick;
  const hunt = row.hunt ?? {
    nick: row.nick,
    swf: previous?.hunt.swf ?? "",
    scale: previous?.hunt.scale ?? UNMAPPED_HUNT_SCALE,
    fps: previous?.hunt.fps ?? UNMAPPED_HUNT_FPS,
    speed: previous?.hunt.speed ?? UNMAPPED_HUNT_SPEED,
    avatar: row.avatar,
    kind: row.kind,
    hideOnMap: 0,
    sk: row.sk,
    body: row.body,
  };
  return {
    id: row.id,
    title,
    level: row.level,
    maxHp: row.maxHp,
    strength: row.strength,
    sk: row.sk,
    avatar: row.avatar,
    body: row.body,
    kind: row.kind,
    ultrabeast: row.ultrabeast,
    baseExp: row.baseExp,
    moneyMin: row.moneyMin,
    moneyMax: row.moneyMax,
    dropIds: row.dropIds,
    hunt: {
      ...hunt,
      nick: row.nick,
      avatar: row.avatar,
      kind: row.kind,
      sk: row.sk,
      body: row.body,
    },
    provenance: previous?.provenance ?? "gap-fill",
  };
}

function overlayBotFromRecord(key: string, raw: unknown): OverlayBot {
  if (!isRecord(raw)) throw new Error(`bots-overlay.json bot ${key} must be an object`);
  const id = amfInteger(raw.id ?? key, `bots-overlay.json bot ${key} id`);
  if (id < 1) throw new Error(`bots-overlay.json bot ${key} id must be positive`);
  const nick = stringField(raw.nick, `bots-overlay.json bot ${id} nick`);
  if (!nick) throw new Error(`bots-overlay.json bot ${id} nick is required`);
  const level = amfInteger(raw.level, `bots-overlay.json bot ${id} level`);
  if (level < 1) throw new Error(`bots-overlay.json bot ${id} level must be positive`);
  const skills = isRecord(raw.skills) ? raw.skills : {};
  const maxHp = amfOmittedZeroInteger(raw.vit ?? skills.VIT, `bots-overlay.json bot ${id} VIT`);
  if (maxHp < 1) throw new Error(`bots-overlay.json bot ${id} VIT must be positive`);
  const extra = extraObject(raw.extra_json);
  return {
    id,
    nick,
    level,
    sk: stringField(raw.sk, `bots-overlay.json bot ${id} sk`),
    avatar: stringField(raw.avatar, `bots-overlay.json bot ${id} avatar`),
    body: stringField(raw.body, `bots-overlay.json bot ${id} body`),
    kind: amfOmittedZeroInteger(raw.kind, `bots-overlay.json bot ${id} kind`),
    ultrabeast: amfOmittedZeroInteger(raw.ultrabeast, `bots-overlay.json bot ${id} ultrabeast`),
    baseExp: amfOmittedZeroInteger(
      raw.base_exp ?? raw.baseExp,
      `bots-overlay.json bot ${id} base_exp`,
    ),
    moneyMin: amfNumber(raw.money_min ?? raw.moneyMin, `bots-overlay.json bot ${id} money_min`),
    moneyMax: amfNumber(raw.money_max ?? raw.moneyMax, `bots-overlay.json bot ${id} money_max`),
    strength: amfOmittedZeroInteger(raw.str ?? skills.STR, `bots-overlay.json bot ${id} STR`),
    maxHp,
    dropIds: idMapToList(raw.drop_artikul_ids ?? raw.drop, `bots-overlay.json bot ${id} drop`),
    hunt: huntFromExtra(id, nick, extra),
    loot: parseOverlayLoot(id, raw.loot),
  };
}

function huntFromExtra(
  id: number,
  nick: string,
  extra: Record<string, unknown>,
): BotHuntLook | null {
  const hunt = isRecord(extra.hunt) ? extra.hunt : null;
  if (!hunt) return null;
  const swf = stringField(hunt.hunt_swf ?? hunt.huntSwf, `bots-overlay.json bot ${id} hunt_swf`);
  if (!swf) return null;
  const hide = amfOmittedZeroInteger(
    hunt.hide_on_map ?? hunt.hideOnMap,
    `bots-overlay.json bot ${id} hide_on_map`,
  );
  if (hide !== 0 && hide !== 1) {
    throw new Error(`bots-overlay.json bot ${id} hide_on_map must be 0 or 1`);
  }
  return {
    nick,
    swf,
    scale: positiveOrThrow(
      amfInteger(hunt.hunt_scale ?? hunt.huntScale, `bots-overlay.json bot ${id} hunt_scale`),
      `bots-overlay.json bot ${id} hunt_scale`,
    ),
    fps: positiveOrThrow(
      amfInteger(hunt.hunt_fps ?? hunt.huntFps, `bots-overlay.json bot ${id} hunt_fps`),
      `bots-overlay.json bot ${id} hunt_fps`,
    ),
    speed: amfOmittedZeroInteger(hunt.speed, `bots-overlay.json bot ${id} speed`),
    avatar: "",
    kind: 0,
    hideOnMap: hide,
    sk: "",
    body: "",
  };
}

function parseOverlayLoot(id: number, raw: unknown): OverlayLoot | null {
  if (raw === undefined) return null;
  if (!isRecord(raw)) throw new Error(`bots-overlay.json bot ${id} loot must be an object`);
  const entriesIn = raw.entries;
  if (!Array.isArray(entriesIn))
    throw new Error(`bots-overlay.json bot ${id} loot.entries is required`);
  const entries: OverlayLootEntry[] = [];
  const seen = new Set<number>();
  for (const [index, row] of entriesIn.entries()) {
    if (!isRecord(row))
      throw new Error(`bots-overlay.json bot ${id} loot entry ${index} must be an object`);
    const artikulId = amfInteger(
      row.artikulId ?? row.artikul_id,
      `bots-overlay.json bot ${id} loot entry ${index} artikul`,
    );
    if (artikulId < 1) {
      throw new Error(`bots-overlay.json bot ${id} loot entry ${index} artikul must be positive`);
    }
    if (seen.has(artikulId)) {
      throw new Error(`bots-overlay.json bot ${id} duplicate loot artikul ${artikulId}`);
    }
    seen.add(artikulId);
    const countMin = amfInteger(
      row.countMin ?? row.count_min,
      `bots-overlay.json bot ${id} loot entry ${index} countMin`,
    );
    const countMax = amfInteger(
      row.countMax ?? row.count_max,
      `bots-overlay.json bot ${id} loot entry ${index} countMax`,
    );
    if (countMin < 1 || countMax < countMin) {
      throw new Error(`bots-overlay.json bot ${id} loot entry ${index} counts are invalid`);
    }
    entries.push({
      artikulId,
      dropWeight: amfInteger(
        row.dropWeight ?? row.drop_weight,
        `bots-overlay.json bot ${id} loot entry ${index} dropWeight`,
      ),
      countMin,
      countMax,
    });
  }
  return {
    dropCnt: amfInteger(raw.dropCnt ?? raw.drop_cnt, `bots-overlay.json bot ${id} drop_cnt`),
    bonusChance: amfNumber(
      raw.bonusChance ?? raw.bonus_chance,
      `bots-overlay.json bot ${id} bonus_chance`,
    ),
    bonusMin: amfInteger(raw.bonusMin ?? raw.bonus_min, `bots-overlay.json bot ${id} bonus_min`),
    bonusMax: amfInteger(raw.bonusMax ?? raw.bonus_max, `bots-overlay.json bot ${id} bonus_max`),
    nothingWeight: nothingWeight(raw),
    entries,
  };
}

function nothingWeight(raw: Record<string, unknown>): number | null {
  if (!("nothingWeight" in raw) && !("nothing_weight" in raw)) return null;
  const value = raw.nothingWeight ?? raw.nothing_weight;
  if (value === null || value === "") return null;
  return amfInteger(value, "bots-overlay.json nothing_weight");
}

function extraObject(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw === "string") {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error("bots-overlay.json extra_json must be an object");
    return parsed;
  }
  if (!isRecord(raw)) throw new Error("bots-overlay.json extra_json must be an object");
  return raw;
}

function stringField(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function positiveOrThrow(value: number, label: string): number {
  if (value < 1) throw new Error(`${label} must be positive`);
  return value;
}
