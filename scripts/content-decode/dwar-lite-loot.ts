/**
 * Dwar-lite drop weights from `jgr-emu/src/fight/lootTable.ts` seed path.
 * Rates are invented, not live SoT. DATA-02 artifacts have no quality column —
 * quality is the named zero of that catalog, not a guessed overlay.
 */

export type ArtikulLootMeta = Readonly<{
  id: number;
  typeId: string;
  kindId: number;
  quality: 0;
  priceGold: number;
  bagStack: number;
}>;

export type BotLootMeta = Readonly<{
  level: number;
  ultrabeast: number;
}>;

export type LootEntry = Readonly<{
  artikulId: number;
  dropWeight: number;
  countMin: number;
  countMax: number;
}>;

export type LootTable = Readonly<{
  dropCnt: number;
  bonusChance: number;
  bonusMin: number;
  bonusMax: number;
  nothingWeight: number;
  entries: readonly LootEntry[];
}>;

const STACKABLE_TYPE_IDS = new Set(["7", "10", "67"]);
const DEFAULT_NOTHING_FRACTION = 0.2;

export function buildLootTableFromIds(
  ids: readonly number[],
  bot: BotLootMeta,
  artikulById: ReadonlyMap<number, ArtikulLootMeta>,
): LootTable {
  const seen = new Set<number>();
  const entries: LootEntry[] = [];
  for (const artikulId of ids) {
    if (artikulId < 1) throw new Error(`Loot artikul id ${artikulId} is invalid`);
    if (seen.has(artikulId)) continue;
    seen.add(artikulId);
    const meta = artikulById.get(artikulId);
    if (!meta) throw new Error(`Loot artikul ${artikulId} is not in the item corpus`);
    entries.push(entryFromArtikul(meta));
  }
  const roll = defaultRollForBot(bot);
  return {
    ...roll,
    nothingWeight: integerNothing(weightedPoolSum(entries) * DEFAULT_NOTHING_FRACTION),
    entries,
  };
}

export function authoredLootTable(input: {
  dropCnt: number;
  bonusChance: number;
  bonusMin: number;
  bonusMax: number;
  nothingWeight: number | null;
  entries: readonly LootEntry[];
}): LootTable {
  const entries = input.entries.map((entry) => ({
    artikulId: entry.artikulId,
    dropWeight: integerWeight(entry.dropWeight),
    countMin: entry.countMin,
    countMax: entry.countMax,
  }));
  const nothing =
    input.nothingWeight === null
      ? integerNothing(weightedPoolSum(entries) * DEFAULT_NOTHING_FRACTION)
      : integerNothing(input.nothingWeight);
  return {
    dropCnt: input.dropCnt,
    bonusChance: input.bonusChance,
    bonusMin: input.bonusMin,
    bonusMax: input.bonusMax,
    nothingWeight: nothing,
    entries,
  };
}

function defaultRollForBot(bot: BotLootMeta): Omit<LootTable, "nothingWeight" | "entries"> {
  const level = bot.level;
  const ultra = bot.ultrabeast > 0;
  if (ultra) return { dropCnt: 3, bonusChance: 0.15, bonusMin: 1, bonusMax: 2 };
  if (level >= 20) return { dropCnt: 2, bonusChance: 0.12, bonusMin: 1, bonusMax: 2 };
  if (level >= 10) return { dropCnt: 1, bonusChance: 0.12, bonusMin: 1, bonusMax: 2 };
  return { dropCnt: 1, bonusChance: 0.1, bonusMin: 1, bonusMax: 1 };
}

function entryFromArtikul(meta: ArtikulLootMeta): LootEntry {
  const typeId = meta.typeId;
  const kindId = meta.kindId;
  const quality = meta.quality;
  const price = meta.priceGold;
  const stackable = STACKABLE_TYPE_IDS.has(typeId);
  const bag = meta.bagStack;
  if (typeId === "21" || typeId === "57") {
    return { artikulId: meta.id, dropWeight: 2, countMin: 1, countMax: 1 };
  }
  if (typeId === "10") {
    return { artikulId: meta.id, dropWeight: 18, countMin: 1, countMax: softCapCount(2, bag) };
  }
  if (typeId === "7") {
    if (kindId === 152) {
      return { artikulId: meta.id, dropWeight: 28, countMin: 3, countMax: softCapCount(15, bag) };
    }
    if (kindId === 154) {
      return { artikulId: meta.id, dropWeight: 22, countMin: 1, countMax: softCapCount(2, bag) };
    }
    if (price <= 0) return { artikulId: meta.id, dropWeight: 8, countMin: 1, countMax: 1 };
    return { artikulId: meta.id, dropWeight: 18, countMin: 1, countMax: softCapCount(2, bag) };
  }
  if (typeId === "67") {
    if (price >= 100 || quality >= 1) {
      return { artikulId: meta.id, dropWeight: price >= 200 ? 6 : 10, countMin: 1, countMax: 1 };
    }
    return { artikulId: meta.id, dropWeight: 30, countMin: 1, countMax: softCapCount(3, bag) };
  }
  if (typeId === "11") {
    return {
      artikulId: meta.id,
      dropWeight: Math.max(4, Math.round(12 - quality * 3)),
      countMin: 1,
      countMax: 1,
    };
  }
  if (typeId === "2" || !stackable) {
    let weight = 10;
    if (quality >= 2) weight = 4;
    else if (quality >= 1) weight = 6;
    else if (price >= 50) weight = 5;
    else if (price >= 5) weight = 10;
    else weight = 14;
    return { artikulId: meta.id, dropWeight: weight, countMin: 1, countMax: 1 };
  }
  if (price <= 0) return { artikulId: meta.id, dropWeight: 5, countMin: 1, countMax: 1 };
  if (price < 5) {
    return { artikulId: meta.id, dropWeight: 25, countMin: 1, countMax: softCapCount(2, bag) };
  }
  return { artikulId: meta.id, dropWeight: 12, countMin: 1, countMax: 1 };
}

function softCapCount(max: number, bagStack: number): number {
  if (bagStack <= 0) return max;
  return Math.min(max, bagStack);
}

function weightedPoolSum(entries: readonly LootEntry[]): number {
  let sum = 0;
  for (const entry of entries) {
    if (entry.dropWeight > 0) sum += entry.dropWeight;
  }
  return sum;
}

function integerNothing(value: number): number {
  const rounded = Math.round(value);
  if (!Number.isInteger(rounded) || rounded < 0) {
    throw new Error(`loot nothingWeight ${value} is not a non-negative integer`);
  }
  return rounded;
}

function integerWeight(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`loot dropWeight ${value} is not a non-negative integer`);
  }
  return value;
}
