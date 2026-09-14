import fs from "node:fs";
import path from "node:path";

export function mergeGeneratedBundleFiles(
  decoded: Readonly<Record<string, unknown>>,
  directory: string,
): Record<string, unknown> {
  return mergeBotSpellBooksFile(
    mergeBotLootFile(mergeBotsFile(mergeItemsFile(decoded, directory), directory), directory),
    directory,
  );
}

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
  const seen = new Map<number, "bundle" | string>();
  const merged: unknown[] = [];
  for (const [source, rows] of [
    ["bundle", left],
    [rightSource, right],
  ] as const) {
    for (const row of rows) {
      const id = documentId(row, label);
      const previous = seen.get(id);
      if (previous) throw new Error(`Duplicate ${label} ${id} in ${previous} and ${source}`);
      seen.set(id, source);
      merged.push(row);
    }
  }
  return merged;
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
