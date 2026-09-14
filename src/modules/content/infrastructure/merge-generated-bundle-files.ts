import fs from "node:fs";
import path from "node:path";

export function mergeGeneratedBundleFiles(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
): Record<string, unknown> {
  let merged = mergeBotSpellBooksFile(
    mergeBotLootFile(mergeBotsFile(mergeItemsFile(decoded, directory), directory), directory),
    directory,
  );
  for (const spec of ARRAY_FILES) {
    merged = mergeArrayFile(merged, directory, spec);
  }
  return merged;
}

const ARRAY_FILES: ReadonlyArray<{
  fileKey: string;
  bundleKey: string;
  label: string;
  keyOf: (row: unknown, label: string) => string;
}> = [
  { fileKey: "areasFile", bundleKey: "areas", label: "area id", keyOf: stringDocumentId },
  { fileKey: "areaLinksFile", bundleKey: "areaLinks", label: "area_link", keyOf: areaLinkKey },
  {
    fileKey: "huntSpawnsFile",
    bundleKey: "huntSpawns",
    label: "hunt_spawn id",
    keyOf: numericDocumentId,
  },
  { fileKey: "storeTypesFile", bundleKey: "storeTypes", label: "store_type", keyOf: storeTypeKey },
  { fileKey: "storeLotsFile", bundleKey: "storeLots", label: "store_lot", keyOf: storeLotKey },
  {
    fileKey: "reputationTracksFile",
    bundleKey: "reputationTracks",
    label: "reputation track",
    keyOf: reputationTrackKey,
  },
  { fileKey: "bonusesFile", bundleKey: "bonuses", label: "bonus id", keyOf: numericDocumentId },
  { fileKey: "useScriptsFile", bundleKey: "useScripts", label: "use_script", keyOf: useScriptKey },
  {
    fileKey: "assistantTypesFile",
    bundleKey: "assistantTypes",
    label: "assistant type",
    keyOf: numericDocumentId,
  },
  {
    fileKey: "farmResourcesFile",
    bundleKey: "farmResources",
    label: "farm resource",
    keyOf: numericDocumentId,
  },
  {
    fileKey: "areaFarmsFile",
    bundleKey: "areaFarms",
    label: "area farm",
    keyOf: areaFarmKey,
  },
  {
    fileKey: "craftRecipesFile",
    bundleKey: "craftRecipes",
    label: "craft recipe",
    keyOf: numericDocumentId,
  },
  {
    fileKey: "dungeonsFile",
    bundleKey: "dungeons",
    label: "dungeon",
    keyOf: dungeonKey,
  },
];

function mergeItemsFile(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
): Record<string, unknown> {
  const relative = decoded.itemsFile;
  const rest: Record<string, unknown> = { ...decoded };
  delete rest.itemsFile;
  const fromBundle = rest.artifacts;
  if (relative === undefined) {
    if (!Array.isArray(fromBundle)) {
      throw new Error("Content bundle artifacts or itemsFile is required");
    }
    return rest;
  }
  if (typeof relative !== "string" || !relative) {
    throw new Error("Content bundle itemsFile must be a relative path");
  }
  const fromFile = readJsonArray(path.resolve(directory, relative));
  const existing = fromBundle === undefined ? [] : fromBundle;
  if (!Array.isArray(existing)) throw new Error("Content bundle artifacts must be an array");
  return { ...rest, artifacts: concatById(existing, fromFile, "artifact artikul_id", "itemsFile") };
}

function mergeArrayFile(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
  spec: Readonly<{
    fileKey: string;
    bundleKey: string;
    label: string;
    keyOf: (row: unknown, label: string) => string;
  }>,
): Record<string, unknown> {
  const relative = decoded[spec.fileKey];
  const rest: Record<string, unknown> = { ...decoded };
  delete rest[spec.fileKey];
  const fromBundle = rest[spec.bundleKey];
  if (relative === undefined) {
    if (!Array.isArray(fromBundle)) {
      throw new Error(`Content bundle ${spec.bundleKey} or ${spec.fileKey} is required`);
    }
    return rest;
  }
  if (typeof relative !== "string" || !relative) {
    throw new Error(`Content bundle ${spec.fileKey} must be a relative path`);
  }
  const fromFile = readJsonArray(path.resolve(directory, relative));
  const existing = fromBundle === undefined ? [] : fromBundle;
  if (!Array.isArray(existing))
    throw new Error(`Content bundle ${spec.bundleKey} must be an array`);
  return {
    ...rest,
    [spec.bundleKey]: concatByKey(existing, fromFile, spec.label, spec.fileKey, spec.keyOf),
  };
}

function mergeBotsFile(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
): Record<string, unknown> {
  const relative = decoded.botsFile;
  const rest: Record<string, unknown> = { ...decoded };
  delete rest.botsFile;
  const fromBundle = rest.bots;
  if (relative === undefined) {
    if (!Array.isArray(fromBundle)) {
      throw new Error("Content bundle bots or botsFile is required");
    }
    return rest;
  }
  if (typeof relative !== "string" || !relative) {
    throw new Error("Content bundle botsFile must be a relative path");
  }
  const fromFile = readJsonArray(path.resolve(directory, relative));
  const existing = fromBundle === undefined ? [] : fromBundle;
  if (!Array.isArray(existing)) throw new Error("Content bundle bots must be an array");
  return { ...rest, bots: concatById(existing, fromFile, "bot id", "botsFile") };
}

function mergeBotLootFile(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
): Record<string, unknown> {
  const relative = decoded.botLootFile;
  const rest: Record<string, unknown> = { ...decoded };
  delete rest.botLootFile;
  if (relative === undefined) return rest;
  if (typeof relative !== "string" || !relative) {
    throw new Error("Content bundle botLootFile must be a relative path");
  }
  if (!Array.isArray(rest.bots)) throw new Error("Content bundle bots must be an array");
  return { ...rest, bots: attachLoot(rest.bots, readJsonArray(path.resolve(directory, relative))) };
}

function mergeBotSpellBooksFile(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
): Record<string, unknown> {
  const relative = decoded.botSpellBooksFile;
  const rest: Record<string, unknown> = { ...decoded };
  delete rest.botSpellBooksFile;
  if (relative === undefined) return rest;
  if (typeof relative !== "string" || !relative) {
    throw new Error("Content bundle botSpellBooksFile must be a relative path");
  }
  if (!Array.isArray(rest.bots)) throw new Error("Content bundle bots must be an array");
  return {
    ...rest,
    bots: attachSpellBooks(rest.bots, readJsonArray(path.resolve(directory, relative))),
  };
}

function concatById(
  left: readonly unknown[],
  right: readonly unknown[],
  label: string,
  rightSource: string,
): unknown[] {
  return concatByKey(left, right, label, rightSource, numericDocumentId);
}

function concatByKey(
  left: readonly unknown[],
  right: readonly unknown[],
  label: string,
  rightSource: string,
  keyOf: (row: unknown, label: string) => string,
): unknown[] {
  const seen = new Map<string, "bundle" | string>();
  const merged: unknown[] = [];
  for (const [source, rows] of [
    ["bundle", left],
    [rightSource, right],
  ] as const) {
    for (const row of rows) {
      const id = keyOf(row, label);
      const previous = seen.get(id);
      if (previous) throw new Error(`Duplicate ${label} ${id} in ${previous} and ${source}`);
      seen.set(id, source);
      merged.push(row);
    }
  }
  return merged;
}

function numericDocumentId(row: unknown, label: string): string {
  return String(documentId(row, label));
}

function stringDocumentId(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const id = row.id;
  if (typeof id !== "string" || !id) throw new Error(`${label} is required`);
  return id;
}

function areaLinkKey(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const fromAreaId = row.fromAreaId;
  const itemId = row.itemId;
  if (typeof fromAreaId !== "string" || !fromAreaId) {
    throw new Error(`${label} fromAreaId is required`);
  }
  if (typeof itemId !== "number" || !Number.isInteger(itemId) || itemId < 0) {
    throw new Error(`${label} itemId is required`);
  }
  return `${fromAreaId}:${itemId}`;
}

function storeTypeKey(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const areaId = row.areaId;
  const typeId = row.typeId;
  if (typeof areaId !== "string" || !areaId) throw new Error(`${label} areaId is required`);
  if (typeof typeId !== "number" || !Number.isInteger(typeId)) {
    throw new Error(`${label} typeId is required`);
  }
  return `${areaId}:${typeId}`;
}

function storeLotKey(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const areaId = row.areaId;
  const lotId = row.lotId;
  if (typeof areaId !== "string" || !areaId) throw new Error(`${label} areaId is required`);
  if (typeof lotId !== "number" || !Number.isInteger(lotId) || lotId < 1) {
    throw new Error(`${label} lotId is required`);
  }
  return `${areaId}:${lotId}`;
}

function reputationTrackKey(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const objectId = row.objectId;
  if (typeof objectId !== "number" || !Number.isInteger(objectId) || objectId < 1) {
    throw new Error(`${label} objectId is required`);
  }
  return String(objectId);
}

function areaFarmKey(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const areaId = row.areaId;
  const huntSpotId = row.huntSpotId;
  if (typeof areaId !== "string" || !areaId) throw new Error(`${label} areaId is required`);
  if (typeof huntSpotId !== "number" || !Number.isInteger(huntSpotId) || huntSpotId < 1) {
    throw new Error(`${label} huntSpotId is required`);
  }
  return `${areaId}:${huntSpotId}`;
}

function dungeonKey(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const artikulId = row.artikulId;
  if (typeof artikulId !== "number" || !Number.isInteger(artikulId) || artikulId < 1) {
    throw new Error(`${label} artikulId is required`);
  }
  return String(artikulId);
}

function useScriptKey(row: unknown, label: string): string {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const bonusId = row.bonusId;
  if (typeof bonusId !== "number" || !Number.isInteger(bonusId) || bonusId < 1) {
    throw new Error(`${label} bonusId is required`);
  }
  return String(bonusId);
}

function attachLoot(bots: readonly unknown[], rows: readonly unknown[]): unknown[] {
  const byId = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    if (!isRecord(row)) throw new Error("bot loot document must be an object");
    const botId = documentId(row.botId !== undefined ? { id: row.botId } : row, "bot loot botId");
    if (byId.has(botId)) throw new Error(`Duplicate bot loot botId ${botId}`);
    byId.set(botId, row);
  }
  const used = new Set<number>();
  const merged = bots.map((bot) => {
    const id = documentId(bot, "bot id");
    const loot = byId.get(id);
    if (!loot) return bot;
    used.add(id);
    if (!isRecord(bot)) throw new Error("Bot document must be an object");
    return {
      ...bot,
      lootDropCnt: loot.lootDropCnt,
      lootBonusChance: loot.lootBonusChance,
      lootBonusMin: loot.lootBonusMin,
      lootBonusMax: loot.lootBonusMax,
      lootNothingWeight: loot.lootNothingWeight,
      lootEntries: loot.lootEntries,
    };
  });
  for (const id of byId.keys()) {
    if (!used.has(id)) throw new Error(`bot loot botId ${id} is not in the bot corpus`);
  }
  return merged;
}

function attachSpellBooks(bots: readonly unknown[], rows: readonly unknown[]): unknown[] {
  const byId = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    if (!isRecord(row)) throw new Error("bot spell book document must be an object");
    const botId = documentId(
      row.botId !== undefined ? { id: row.botId } : row,
      "bot spell book botId",
    );
    if (byId.has(botId)) throw new Error(`Duplicate bot spell book botId ${botId}`);
    byId.set(botId, row);
  }
  const used = new Set<number>();
  const merged = bots.map((bot) => {
    const id = documentId(bot, "bot id");
    const book = byId.get(id);
    if (!book) return bot;
    used.add(id);
    if (!isRecord(bot)) throw new Error("Bot document must be an object");
    return {
      ...bot,
      spellBook: { nothingWeight: book.nothingWeight, spells: book.spells },
    };
  });
  for (const id of byId.keys()) {
    if (!used.has(id)) throw new Error(`bot spell book botId ${id} is not in the bot corpus`);
  }
  return merged;
}

function documentId(row: unknown, label: string): number {
  if (!isRecord(row)) throw new Error(`${label} document must be an object`);
  const id = row.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) {
    throw new Error(`${label} is required`);
  }
  return id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readJsonObject(filePath: string): Record<string, unknown> {
  const decoded = readJson(filePath);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error(`JSON root must be an object: ${filePath}`);
  }
  return decoded as Record<string, unknown>;
}

function readJsonArray(filePath: string): unknown[] {
  const decoded = readJson(filePath);
  if (!Array.isArray(decoded)) throw new Error(`JSON root must be an array: ${filePath}`);
  return decoded;
}

function readJson(filePath: string): unknown {
  if (!filePath) throw new Error("JSON file path is required");
  if (!fs.existsSync(filePath)) throw new Error(`JSON file does not exist: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`File is not valid JSON: ${filePath}`, { cause: error });
  }
}
