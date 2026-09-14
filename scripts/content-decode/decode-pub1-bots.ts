import fs from "node:fs";
import path from "node:path";
import { decodeAmf3 } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { botDocumentsFromSources, type GeneratedBotDocument } from "./assemble-bot-documents.ts";
import { applyBotOverlay, loadOverlayBots } from "./bot-overlays.ts";
import { lootDocumentsForBots, type BotLootDocument } from "./bot-loot-tables.ts";
import {
  emptySpellBook,
  spellBooksFromJson,
  type BotSpellBookDocument,
} from "./bot-spell-books-from-json.ts";
import { botsFromBestiaryAmf } from "./bestiary-from-amf.ts";
import { botsFromGapFill } from "./bestiary-gap-fill.ts";
import type { ArtikulLootMeta } from "./dwar-lite-loot.ts";
import { fillUnmappedHuntLooks, loadRadveiHuntLooks } from "./hunt-look-from-radvei.ts";
import { isRecord } from "./amf-fields.ts";
import {
  buildBotLootManifest,
  buildBotSpellBooksManifest,
  buildBotsManifest,
  digestOf,
  fileRecord,
  sha256,
  type Pub1BotLootManifest,
  type Pub1BotSpellBooksManifest,
  type Pub1BotsManifest,
} from "./pub1-bots-manifest.ts";

export type DecodePub1BotsResult = Readonly<{
  bots: readonly GeneratedBotDocument[];
  loot: readonly BotLootDocument[];
  spellBooks: readonly BotSpellBookDocument[];
  botsManifest: Pub1BotsManifest;
  lootManifest: Pub1BotLootManifest;
  spellBooksManifest: Pub1BotSpellBooksManifest;
}>;

export function decodePub1Bots(input: {
  pub1Dir: string;
  overlayFile: string;
  gapFillFile: string;
  huntLooksFile: string;
  spellBookFile: string;
  itemsFile: string;
}): DecodePub1BotsResult {
  if (!input.pub1Dir) throw new Error("PUB1_DIR is required");
  const amfPath = path.join(input.pub1Dir, "images/locale/ru/amf/bestiary.amf");
  const amfBytes = readBytes(amfPath, "bestiary.amf");
  let decoded: unknown;
  try {
    decoded = decodeAmf3(amfBytes);
  } catch (error) {
    throw new Error("Unreadable AMF record bestiary.amf", { cause: error });
  }
  const overlayBytes = readBytes(input.overlayFile, "bots-overlay.json");
  const gapBytes = readBytes(input.gapFillFile, "bestiary-bots.json");
  const huntBytes = readBytes(input.huntLooksFile, "radvei-hunt-bots.json");
  const spellBytes = readBytes(input.spellBookFile, "bot-spell-book.json");
  const itemsBytes = readBytes(input.itemsFile, "pub1-items.generated.json");
  const amfBots = botsFromBestiaryAmf(decoded);
  const withGap = [
    ...amfBots,
    ...botsFromGapFill(
      parseJson(gapBytes, input.gapFillFile),
      new Set(amfBots.map((bot) => bot.id)),
    ),
  ];
  const overlay = loadOverlayBots(parseJson(overlayBytes, input.overlayFile));
  const overlayById = new Map(overlay.map((row) => [row.id, row]));
  const withOverlay = applyBotOverlay(withGap, overlay);
  const withHunt = fillUnmappedHuntLooks(
    withOverlay,
    loadRadveiHuntLooks(parseJson(huntBytes, input.huntLooksFile)),
  );
  const items = artifactsFromItemsFile(parseJson(itemsBytes, input.itemsFile));
  const bots = botDocumentsFromSources(withHunt);
  const loot = lootDocumentsForBots(withHunt, overlayById, items.meta);
  const authoredBooks = spellBooksFromJson(
    parseJson(spellBytes, input.spellBookFile),
    new Set(withHunt.map((bot) => bot.id)),
    items.spells,
  );
  const spellBooks = mergeSpellBooks(
    withHunt.map((bot) => bot.id),
    authoredBooks,
  );
  const files = [
    fileRecord("images/locale/ru/amf/bestiary.amf", amfBytes),
    fileRecord(path.basename(input.overlayFile), overlayBytes),
    fileRecord(path.basename(input.gapFillFile), gapBytes),
    fileRecord(path.basename(input.huntLooksFile), huntBytes),
    fileRecord(path.basename(input.spellBookFile), spellBytes),
    fileRecord(path.basename(input.itemsFile), itemsBytes),
  ];
  const botsManifest = buildBotsManifest({
    files,
    keys: bots.map((bot) => ({ key: String(bot.id), digest: digestOf(bot) })),
  });
  const lootManifest = buildBotLootManifest({
    filesDigest: botsManifest.filesDigest,
    keys: loot.map((row) => ({ key: String(row.botId), digest: digestOf(row) })),
  });
  const spellBooksManifest = buildBotSpellBooksManifest({
    filesDigest: botsManifest.filesDigest,
    keys: spellBooks.map((row) => ({ key: String(row.botId), digest: digestOf(row) })),
  });
  return { bots, loot, spellBooks, botsManifest, lootManifest, spellBooksManifest };
}

function mergeSpellBooks(
  botIds: readonly number[],
  authored: readonly BotSpellBookDocument[],
): BotSpellBookDocument[] {
  const byId = new Map(authored.map((book) => [book.botId, book]));
  return botIds.map((id) => byId.get(id) ?? emptySpellBook(id));
}

function artifactsFromItemsFile(decoded: unknown): {
  meta: Map<number, ArtikulLootMeta>;
  spells: Map<number, Readonly<Record<string, unknown>>>;
} {
  if (!Array.isArray(decoded)) throw new Error("items file root must be an array");
  const meta = new Map<number, ArtikulLootMeta>();
  const spells = new Map<number, Readonly<Record<string, unknown>>>();
  for (const row of decoded) {
    if (!isRecord(row)) throw new Error("Artifact document must be an object");
    const id = row.id;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 1) {
      throw new Error("Artifact document id is required");
    }
    if (meta.has(id)) throw new Error(`Duplicate artifact artikul_id ${id} in items file`);
    if (typeof row.typeId !== "string") throw new Error(`artifact ${id} typeId is required`);
    if (typeof row.kindId !== "number") throw new Error(`artifact ${id} kindId is required`);
    if (typeof row.priceMinor !== "number")
      throw new Error(`artifact ${id} priceMinor is required`);
    if (typeof row.bagStack !== "number") throw new Error(`artifact ${id} bagStack is required`);
    meta.set(id, {
      id,
      typeId: row.typeId,
      kindId: row.kindId,
      quality: 0,
      priceGold: row.priceMinor / 100,
      bagStack: row.bagStack,
    });
    const extra = row.extra;
    if (isRecord(extra) && isRecord(extra.spell)) spells.set(id, extra.spell);
  }
  return { meta, spells };
}

function readBytes(filePath: string, label: string): Buffer {
  if (!filePath) throw new Error(`${label} path is required`);
  if (!fs.existsSync(filePath)) throw new Error(`${label} does not exist: ${filePath}`);
  return fs.readFileSync(filePath);
}

function parseJson(bytes: Buffer, filePath: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`File is not valid JSON: ${filePath}`, { cause: error });
  }
}

export function outputDigests(result: DecodePub1BotsResult): Readonly<{
  bots: string;
  loot: string;
  spellBooks: string;
}> {
  return {
    bots: sha256(JSON.stringify(result.bots)),
    loot: sha256(JSON.stringify(result.loot)),
    spellBooks: sha256(JSON.stringify(result.spellBooks)),
  };
}
