import fs from "node:fs";
import path from "node:path";
import { decodeDungeons, outputDigest } from "./content-decode/decode-dungeons.ts";

const root = process.cwd();
const pub1Dir = process.env.PUB1_DIR;
if (!pub1Dir) throw new Error("PUB1_DIR is required");
const dungeonsDir = path.resolve(root, process.env.DUNGEONS_DIR ?? "content/dungeons");
const outFile = path.resolve(
  root,
  process.env.DUNGEONS_OUTPUT ?? "content/dungeons.generated.json",
);
const manifestFile = path.resolve(
  root,
  process.env.DUNGEONS_MANIFEST ?? "content/dungeons.generated.manifest.json",
);

const result = decodeDungeons({
  pub1Dir: path.resolve(root, pub1Dir),
  dungeonsDir,
});

if (fs.existsSync(manifestFile)) {
  const previous = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as { corpusDigest?: string };
  if (previous.corpusDigest === outputDigest(result)) {
    process.stdout.write(
      `Unchanged corpus digest ${result.dungeonsManifest.corpusDigest}; left generated dungeon file\n`,
    );
    process.exit(0);
  }
}

fs.writeFileSync(outFile, `${JSON.stringify(result.dungeons)}\n`);
fs.writeFileSync(manifestFile, `${JSON.stringify(result.dungeonsManifest, null, 2)}\n`);
process.stdout.write(
  `Wrote ${result.dungeons.length} dungeons digest ${result.dungeonsManifest.corpusDigest}\n`,
);
