import fs from "node:fs";
import path from "node:path";
import { decodePub1Bots, outputDigests } from "./content-decode/decode-pub1-bots.ts";

const root = process.cwd();
const pub1Dir = process.env.PUB1_DIR;
if (!pub1Dir) throw new Error("PUB1_DIR is required");
const overlayFile = path.resolve(
  root,
  process.env.BOTS_OVERLAY_FILE ?? "content/bots-overlay.json",
);
const gapFillFile = path.resolve(
  root,
  process.env.BESTIARY_BOTS_FILE ?? "content/bestiary-bots.json",
);
const huntLooksFile = path.resolve(
  root,
  process.env.RADVEI_HUNT_BOTS_FILE ?? "content/radvei-hunt-bots.json",
);
const spellBookFile = path.resolve(
  root,
  process.env.BOT_SPELL_BOOK_FILE ?? "content/bot-spell-book.json",
);
const itemsFile = path.resolve(
  root,
  process.env.PUB1_ITEMS_OUTPUT ?? "content/pub1-items.generated.json",
);
const botsFile = path.resolve(root, process.env.PUB1_BOTS_OUTPUT ?? "content/bots.generated.json");
const lootFile = path.resolve(
  root,
  process.env.PUB1_BOT_LOOT_OUTPUT ?? "content/bot-loot.generated.json",
);
const spellFile = path.resolve(
  root,
  process.env.PUB1_BOT_SPELL_BOOKS_OUTPUT ?? "content/bot-spell-books.generated.json",
);
const botsManifestFile = path.resolve(
  root,
  process.env.PUB1_BOTS_MANIFEST ?? "content/bots.generated.manifest.json",
);
const lootManifestFile = path.resolve(
  root,
  process.env.PUB1_BOT_LOOT_MANIFEST ?? "content/bot-loot.generated.manifest.json",
);
const spellManifestFile = path.resolve(
  root,
  process.env.PUB1_BOT_SPELL_BOOKS_MANIFEST ?? "content/bot-spell-books.generated.manifest.json",
);

const result = decodePub1Bots({
  pub1Dir: path.resolve(root, pub1Dir),
  overlayFile,
  gapFillFile,
  huntLooksFile,
  spellBookFile,
  itemsFile,
});

if (
  fs.existsSync(botsManifestFile) &&
  fs.existsSync(lootManifestFile) &&
  fs.existsSync(spellManifestFile)
) {
  const previousBots = JSON.parse(fs.readFileSync(botsManifestFile, "utf8")) as {
    corpusDigest?: string;
  };
  const previousLoot = JSON.parse(fs.readFileSync(lootManifestFile, "utf8")) as {
    corpusDigest?: string;
  };
  const previousSpells = JSON.parse(fs.readFileSync(spellManifestFile, "utf8")) as {
    corpusDigest?: string;
  };
  if (
    previousBots.corpusDigest === result.botsManifest.corpusDigest &&
    previousLoot.corpusDigest === result.lootManifest.corpusDigest &&
    previousSpells.corpusDigest === result.spellBooksManifest.corpusDigest
  ) {
    process.stdout.write(
      `Unchanged corpus digest ${result.botsManifest.corpusDigest}; left generated bot files\n`,
    );
    process.exit(0);
  }
}

fs.writeFileSync(botsFile, `${JSON.stringify(result.bots)}\n`);
fs.writeFileSync(lootFile, `${JSON.stringify(result.loot)}\n`);
fs.writeFileSync(spellFile, `${JSON.stringify(result.spellBooks)}\n`);
fs.writeFileSync(botsManifestFile, `${JSON.stringify(result.botsManifest, null, 2)}\n`);
fs.writeFileSync(lootManifestFile, `${JSON.stringify(result.lootManifest, null, 2)}\n`);
fs.writeFileSync(spellManifestFile, `${JSON.stringify(result.spellBooksManifest, null, 2)}\n`);
const digests = outputDigests(result);
process.stdout.write(
  `Wrote ${result.bots.length} bots digest ${digests.bots}; ${result.loot.length} loot tables; ${result.spellBooks.length} spell books\n`,
);
