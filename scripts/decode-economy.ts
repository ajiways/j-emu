import fs from "node:fs";
import path from "node:path";
import { decodeEconomy, outputDigests } from "./content-decode/decode-economy.ts";

const root = process.cwd();
const storesDir = path.resolve(root, process.env.STORES_DIR ?? "content/stores");
const reputationTracksFile = path.resolve(
  root,
  process.env.REPUTATION_TRACKS_FILE ?? "content/reputation-tracks.json",
);
const bonusesFile = path.resolve(root, process.env.BONUSES_FILE ?? "content/bonuses.json");
const artifactUseFile = path.resolve(
  root,
  process.env.ARTIFACT_USE_FILE ?? "content/artifact-use.json",
);
const storeTypesFile = path.resolve(
  root,
  process.env.STORE_TYPES_OUTPUT ?? "content/store-types.generated.json",
);
const storeLotsFile = path.resolve(
  root,
  process.env.STORE_LOTS_OUTPUT ?? "content/store-lots.generated.json",
);
const reputationOut = path.resolve(
  root,
  process.env.REPUTATION_TRACKS_OUTPUT ?? "content/reputation-tracks.generated.json",
);
const bonusesOut = path.resolve(
  root,
  process.env.BONUSES_OUTPUT ?? "content/bonuses.generated.json",
);
const useScriptsOut = path.resolve(
  root,
  process.env.USE_SCRIPTS_OUTPUT ?? "content/use-scripts.generated.json",
);
const storeTypesManifestFile = path.resolve(
  root,
  process.env.STORE_TYPES_MANIFEST ?? "content/store-types.generated.manifest.json",
);
const storeLotsManifestFile = path.resolve(
  root,
  process.env.STORE_LOTS_MANIFEST ?? "content/store-lots.generated.manifest.json",
);
const reputationManifestFile = path.resolve(
  root,
  process.env.REPUTATION_TRACKS_MANIFEST ?? "content/reputation-tracks.generated.manifest.json",
);
const bonusesManifestFile = path.resolve(
  root,
  process.env.BONUSES_MANIFEST ?? "content/bonuses.generated.manifest.json",
);
const useScriptsManifestFile = path.resolve(
  root,
  process.env.USE_SCRIPTS_MANIFEST ?? "content/use-scripts.generated.manifest.json",
);

const result = decodeEconomy({
  storesDir,
  reputationTracksFile,
  bonusesFile,
  artifactUseFile,
});

if (
  fs.existsSync(storeTypesManifestFile) &&
  fs.existsSync(storeLotsManifestFile) &&
  fs.existsSync(reputationManifestFile) &&
  fs.existsSync(bonusesManifestFile) &&
  fs.existsSync(useScriptsManifestFile)
) {
  const previous = [
    storeTypesManifestFile,
    storeLotsManifestFile,
    reputationManifestFile,
    bonusesManifestFile,
    useScriptsManifestFile,
  ].map((file) => JSON.parse(fs.readFileSync(file, "utf8")) as { corpusDigest?: string });
  const current = [
    result.storeTypesManifest.corpusDigest,
    result.storeLotsManifest.corpusDigest,
    result.reputationTracksManifest.corpusDigest,
    result.bonusesManifest.corpusDigest,
    result.useScriptsManifest.corpusDigest,
  ];
  if (previous.every((manifest, index) => manifest.corpusDigest === current[index])) {
    process.stdout.write(
      `Unchanged corpus digest ${result.storeTypesManifest.corpusDigest}; left generated economy files\n`,
    );
    process.exit(0);
  }
}

fs.writeFileSync(storeTypesFile, `${JSON.stringify(result.storeTypes)}\n`);
fs.writeFileSync(storeLotsFile, `${JSON.stringify(result.storeLots)}\n`);
fs.writeFileSync(reputationOut, `${JSON.stringify(result.reputationTracks)}\n`);
fs.writeFileSync(bonusesOut, `${JSON.stringify(result.bonuses)}\n`);
fs.writeFileSync(useScriptsOut, `${JSON.stringify(result.useScripts)}\n`);
fs.writeFileSync(storeTypesManifestFile, `${JSON.stringify(result.storeTypesManifest, null, 2)}\n`);
fs.writeFileSync(storeLotsManifestFile, `${JSON.stringify(result.storeLotsManifest, null, 2)}\n`);
fs.writeFileSync(
  reputationManifestFile,
  `${JSON.stringify(result.reputationTracksManifest, null, 2)}\n`,
);
fs.writeFileSync(bonusesManifestFile, `${JSON.stringify(result.bonusesManifest, null, 2)}\n`);
fs.writeFileSync(useScriptsManifestFile, `${JSON.stringify(result.useScriptsManifest, null, 2)}\n`);
const digests = outputDigests(result);
process.stdout.write(
  `Wrote ${result.storeTypes.length} store types, ${result.storeLots.length} lots, ${result.reputationTracks.length} reputation tracks, ${result.bonuses.length} bonuses, ${result.useScripts.length} use scripts digest ${digests.storeLots}\n`,
);
