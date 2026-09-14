import fs from "node:fs";
import path from "node:path";
import type {
  BonusDocument,
  ReputationTrackDocument,
  StoreLotDocument,
  StoreTypeDocument,
  UseScriptDocument,
} from "../../src/modules/content/domain/content-playable-entities.ts";
import { bonusesFromJson } from "./bonuses-from-json.ts";
import {
  buildBonusesManifest,
  buildReputationTracksManifest,
  buildStoreLotsManifest,
  buildStoreTypesManifest,
  buildUseScriptsManifest,
  type EconomyManifest,
} from "./economy-manifest.ts";
import { digestOf, fileRecord, type SourceFileRecord } from "./pub1-bots-manifest.ts";
import { reputationTracksFromJson } from "./reputation-from-json.ts";
import { storeFromDump } from "./store-from-dump.ts";
import { useScriptsFromJson } from "./use-scripts-from-json.ts";

export type DecodeEconomyResult = Readonly<{
  storeTypes: readonly StoreTypeDocument[];
  storeLots: readonly StoreLotDocument[];
  reputationTracks: readonly ReputationTrackDocument[];
  bonuses: readonly BonusDocument[];
  useScripts: readonly UseScriptDocument[];
  storeTypesManifest: EconomyManifest;
  storeLotsManifest: EconomyManifest;
  reputationTracksManifest: EconomyManifest;
  bonusesManifest: EconomyManifest;
  useScriptsManifest: EconomyManifest;
}>;

export function decodeEconomy(input: {
  storesDir: string;
  reputationTracksFile: string;
  bonusesFile: string;
  artifactUseFile: string;
}): DecodeEconomyResult {
  const storeFiles = listStoreFiles(input.storesDir);
  const reputationBytes = readBytes(input.reputationTracksFile, "reputation-tracks.json");
  const bonusesBytes = readBytes(input.bonusesFile, "bonuses.json");
  const useBytes = readBytes(input.artifactUseFile, "artifact-use.json");
  const files: SourceFileRecord[] = [
    ...storeFiles.map((file) => fileRecord(file.relativePath, file.bytes)),
    fileRecord("reputation-tracks.json", reputationBytes),
    fileRecord("bonuses.json", bonusesBytes),
    fileRecord("artifact-use.json", useBytes),
  ];
  const storeTypes: StoreTypeDocument[] = [];
  const storeLots: StoreLotDocument[] = [];
  const typeSeen = new Set<string>();
  const lotSeen = new Set<string>();
  for (const file of storeFiles) {
    const decoded = storeFromDump(parseJson(file.bytes, file.absolutePath), file.relativePath);
    for (const type of decoded.types) {
      const key = `${type.areaId}:${type.typeId}`;
      if (typeSeen.has(key)) throw new Error(`Duplicate store_type ${key}`);
      typeSeen.add(key);
      storeTypes.push(type);
    }
    for (const lot of decoded.lots) {
      const key = `${lot.areaId}:${lot.lotId}`;
      if (lotSeen.has(key)) throw new Error(`Duplicate store_lot ${key}`);
      lotSeen.add(key);
      storeLots.push(lot);
    }
  }
  const reputationTracks = reputationTracksFromJson(
    parseJson(reputationBytes, input.reputationTracksFile),
  );
  const bonuses = bonusesFromJson(parseJson(bonusesBytes, input.bonusesFile));
  const useScripts = useScriptsFromJson(parseJson(useBytes, input.artifactUseFile));
  const storeTypesManifest = buildStoreTypesManifest({
    files,
    keys: storeTypes.map((row) => ({ key: `${row.areaId}:${row.typeId}`, digest: digestOf(row) })),
  });
  return {
    storeTypes,
    storeLots,
    reputationTracks,
    bonuses,
    useScripts,
    storeTypesManifest,
    storeLotsManifest: buildStoreLotsManifest({
      filesDigest: storeTypesManifest.filesDigest,
      keys: storeLots.map((row) => ({ key: `${row.areaId}:${row.lotId}`, digest: digestOf(row) })),
    }),
    reputationTracksManifest: buildReputationTracksManifest({
      filesDigest: storeTypesManifest.filesDigest,
      keys: reputationTracks.map((row) => ({ key: String(row.objectId), digest: digestOf(row) })),
    }),
    bonusesManifest: buildBonusesManifest({
      filesDigest: storeTypesManifest.filesDigest,
      keys: bonuses.map((row) => ({ key: String(row.id), digest: digestOf(row) })),
    }),
    useScriptsManifest: buildUseScriptsManifest({
      filesDigest: storeTypesManifest.filesDigest,
      keys: useScripts.map((row) => ({ key: String(row.bonusId), digest: digestOf(row) })),
    }),
  };
}

export function outputDigests(result: DecodeEconomyResult): {
  storeTypes: string;
  storeLots: string;
  reputationTracks: string;
  bonuses: string;
  useScripts: string;
} {
  return {
    storeTypes: result.storeTypesManifest.corpusDigest,
    storeLots: result.storeLotsManifest.corpusDigest,
    reputationTracks: result.reputationTracksManifest.corpusDigest,
    bonuses: result.bonusesManifest.corpusDigest,
    useScripts: result.useScriptsManifest.corpusDigest,
  };
}

function listStoreFiles(directory: string): Array<{
  relativePath: string;
  absolutePath: string;
  bytes: Buffer;
}> {
  if (!directory) throw new Error("stores directory path is required");
  if (!fs.existsSync(directory)) throw new Error("stores directory does not exist");
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (names.length < 1) throw new Error("stores directory has no json files");
  return names.map((name) => {
    const absolutePath = path.join(directory, name);
    return {
      relativePath: `stores/${name}`,
      absolutePath,
      bytes: readBytes(absolutePath, `stores/${name}`),
    };
  });
}

function parseJson(bytes: Buffer, filePath: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`File is not valid JSON: ${filePath}`, { cause: error });
  }
}

function readBytes(filePath: string, label: string): Buffer {
  if (!filePath) throw new Error(`${label} path is required`);
  if (!fs.existsSync(filePath)) throw new Error(`${label} does not exist: ${filePath}`);
  return fs.readFileSync(filePath);
}
