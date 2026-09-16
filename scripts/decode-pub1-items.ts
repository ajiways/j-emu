import fs from "node:fs";
import path from "node:path";
import { decodePub1Items } from "./content-decode/decode-pub1-items.ts";

const root = process.cwd();
const pub1Dir = process.env.PUB1_DIR;
if (!pub1Dir) throw new Error("PUB1_DIR is required");
const weightsFile = path.resolve(
  root,
  process.env.ARTIKUL_WEIGHTS_FILE ?? "content/artikul-weights.json",
);
const outputFile = path.resolve(
  root,
  process.env.PUB1_ITEMS_OUTPUT ?? "content/pub1-items.generated.json",
);
const manifestFile = path.resolve(
  root,
  process.env.PUB1_ITEMS_MANIFEST ?? "content/pub1-items.generated.manifest.json",
);

const result = decodePub1Items({
  pub1Dir: path.resolve(root, pub1Dir),
  weightsFile,
});

if (fs.existsSync(outputFile)) {
  const expected = `${JSON.stringify(result.artifacts)}\n`;
  if (fs.readFileSync(outputFile, "utf8") === expected) {
    process.stdout.write(
      `Unchanged artifacts digest ${result.outputDigest}; left ${path.relative(root, outputFile)}\n`,
    );
    process.exit(0);
  }
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(result.artifacts)}\n`);
fs.writeFileSync(manifestFile, `${JSON.stringify(result.manifest, null, 2)}\n`);
process.stdout.write(
  `Wrote ${result.artifacts.length} artifacts digest ${result.outputDigest} → ${path.relative(root, outputFile)}\n`,
);
