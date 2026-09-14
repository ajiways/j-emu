import fs from "node:fs";
import path from "node:path";
import { decodeAmf3 } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { artifactFromAmf, withWeight, type DecodedArtifactDocument } from "./artifact-from-amf.ts";
import type { DecodedSkillHint } from "./artifact-fields-from-amf.ts";
import { loadArtikulWeights } from "./artikul-weights.ts";
import {
  buildPub1ItemsManifest,
  sha256,
  type AmfFileRecord,
  type Pub1ItemsManifest,
} from "./pub1-items-manifest.ts";

export type DecodePub1ItemsResult = Readonly<{
  artifacts: readonly DecodedArtifactDocument[];
  skillHints: readonly DecodedSkillHint[];
  manifest: Pub1ItemsManifest;
  outputDigest: string;
}>;

export function decodePub1Items(input: {
  pub1Dir: string;
  weightsFile: string;
}): DecodePub1ItemsResult {
  if (!input.pub1Dir) throw new Error("PUB1_DIR is required");
  if (!input.weightsFile) throw new Error("Artikul weights path is required");
  const amfDir = path.join(input.pub1Dir, "images/locale/ru/amf");
  if (!fs.existsSync(amfDir)) {
    throw new Error(`Pub1 AMF directory does not exist: ${amfDir}`);
  }
  const names = fs
    .readdirSync(amfDir)
    .filter((name) => name.startsWith("artifact_artikul_") && name.endsWith(".amf"));
  if (names.length === 0) throw new Error(`No artifact_artikul_*.amf files in ${amfDir}`);
  names.sort((left, right) => artifactIdFromName(left) - artifactIdFromName(right));
  const overlay = loadArtikulWeights(input.weightsFile);
  const files: AmfFileRecord[] = [];
  const artifacts: DecodedArtifactDocument[] = [];
  const byId = new Map<number, string>();
  const skillHints = new Map<string, DecodedSkillHint>();
  for (const name of names) {
    const id = artifactIdFromName(name);
    const filePath = path.join(amfDir, name);
    const bytes = fs.readFileSync(filePath);
    files.push({
      relativePath: `images/locale/ru/amf/${name}`,
      size: bytes.length,
      digest: sha256(bytes),
    });
    let decoded: unknown;
    try {
      decoded = decodeAmf3(bytes);
    } catch (error) {
      throw new Error(`Unreadable AMF record ${name}`, { cause: error });
    }
    const { artifact, skillHints: hints } = artifactFromAmf(id, decoded);
    if (byId.has(id)) {
      throw new Error(`Duplicate artikul_id ${id} in ${byId.get(id)} and ${name}`);
    }
    byId.set(id, name);
    artifacts.push(artifact);
    for (const hint of hints) {
      if (!hint.title) continue;
      const existing = skillHints.get(hint.id);
      if (!existing) skillHints.set(hint.id, hint);
    }
  }
  const weighted = applyWeights(artifacts, overlay.weights);
  const keys = weighted.map((artifact) => ({
    key: String(artifact.id),
    digest: sha256(JSON.stringify(artifact)),
  }));
  const weightsBytes = fs.readFileSync(input.weightsFile);
  const manifest = buildPub1ItemsManifest({
    files,
    weightsFile: path.basename(input.weightsFile),
    weightsDigest: sha256(weightsBytes),
    keys,
  });
  return {
    artifacts: weighted,
    skillHints: [...skillHints.values()].sort((left, right) => left.id.localeCompare(right.id)),
    manifest,
    outputDigest: sha256(JSON.stringify(weighted)),
  };
}

function applyWeights(
  artifacts: readonly DecodedArtifactDocument[],
  weights: ReadonlyMap<number, number>,
): DecodedArtifactDocument[] {
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  for (const id of weights.keys()) {
    if (!byId.has(id)) throw new Error(`Artikul weights ${id} is not in the Pub1 corpus`);
  }
  return artifacts.map((artifact) => {
    const overlay = weights.get(artifact.id);
    return overlay === undefined ? artifact : withWeight(artifact, overlay);
  });
}

function artifactIdFromName(name: string): number {
  const match = /^artifact_artikul_(\d+)\.amf$/.exec(name);
  if (!match?.[1]) throw new Error(`Unknown AMF filename ${name}`);
  const id = Number(match[1]);
  if (!Number.isInteger(id) || id < 1) throw new Error(`Unknown AMF filename ${name}`);
  return id;
}
