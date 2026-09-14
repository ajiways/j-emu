import {
  BONUSES_DECODER_VERSION,
  ECONOMY_DOCUMENT_SCHEMA,
  REPUTATION_TRACKS_DECODER_VERSION,
  STORE_LOTS_DECODER_VERSION,
  STORE_TYPES_DECODER_VERSION,
  USE_SCRIPTS_DECODER_VERSION,
} from "./decoder-version.ts";
import { sha256, type ArtifactKeyDigest } from "./pub1-items-manifest.ts";
import type { SourceFileRecord } from "./pub1-bots-manifest.ts";

export type EconomyManifest = Readonly<{
  sourceGroup: string;
  decoderVersion: string;
  documentSchema: string;
  files?: readonly SourceFileRecord[];
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export function buildStoreTypesManifest(input: {
  files: readonly SourceFileRecord[];
  keys: readonly ArtifactKeyDigest[];
}): EconomyManifest {
  return buildManifest({
    sourceGroup: "DATA-05 / required stores",
    decoderVersion: STORE_TYPES_DECODER_VERSION,
    files: input.files,
    keys: input.keys,
  });
}

export function buildStoreLotsManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): EconomyManifest {
  return buildManifest({
    sourceGroup: "DATA-05 / required stores",
    decoderVersion: STORE_LOTS_DECODER_VERSION,
    filesDigest: input.filesDigest,
    keys: input.keys,
  });
}

export function buildReputationTracksManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): EconomyManifest {
  return buildManifest({
    sourceGroup: "DATA-05 / reputation core subset",
    decoderVersion: REPUTATION_TRACKS_DECODER_VERSION,
    filesDigest: input.filesDigest,
    keys: input.keys,
  });
}

export function buildBonusesManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): EconomyManifest {
  return buildManifest({
    sourceGroup: "DATA-05 / bonuses and consumable USE",
    decoderVersion: BONUSES_DECODER_VERSION,
    filesDigest: input.filesDigest,
    keys: input.keys,
  });
}

export function buildUseScriptsManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): EconomyManifest {
  return buildManifest({
    sourceGroup: "DATA-05 / bonuses and consumable USE",
    decoderVersion: USE_SCRIPTS_DECODER_VERSION,
    filesDigest: input.filesDigest,
    keys: input.keys,
  });
}

function buildManifest(input: {
  sourceGroup: string;
  decoderVersion: string;
  files?: readonly SourceFileRecord[];
  filesDigest?: string;
  keys: readonly ArtifactKeyDigest[];
}): EconomyManifest {
  const files = input.files
    ? [...input.files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    : undefined;
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const filesDigest =
    input.filesDigest ??
    sha256((files ?? []).map((file) => `${file.relativePath}:${file.digest}`).join("\n"));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: input.decoderVersion,
      documentSchema: ECONOMY_DOCUMENT_SCHEMA,
      filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: input.sourceGroup,
    decoderVersion: input.decoderVersion,
    documentSchema: ECONOMY_DOCUMENT_SCHEMA,
    ...(files ? { files } : {}),
    filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}
