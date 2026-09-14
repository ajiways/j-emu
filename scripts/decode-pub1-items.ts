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

if (fs.existsSync(manifestFile) && fs.existsSync(outputFile)) {
  const previous = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
    corpusDigest?: string;
  };
  if (previous.corpusDigest === result.manifest.corpusDigest) {
    process.stdout.write(
      `Unchanged corpus digest ${result.manifest.corpusDigest}; left ${path.relative(root, outputFile)}\n`,
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
