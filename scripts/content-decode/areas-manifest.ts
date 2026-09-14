import {
  AREAS_DECODER_VERSION,
  AREAS_DOCUMENT_SCHEMA,
  AREA_LINKS_DECODER_VERSION,
  HUNT_SPAWNS_DECODER_VERSION,
} from "./decoder-version.ts";
import { sha256, type ArtifactKeyDigest } from "./pub1-items-manifest.ts";
import type { SourceFileRecord } from "./pub1-bots-manifest.ts";

export type AreasManifest = Readonly<{
  sourceGroup: "DATA-04 / areas and links";
  decoderVersion: string;
  documentSchema: string;
  files: readonly SourceFileRecord[];
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export type AreaLinksManifest = Readonly<{
  sourceGroup: "DATA-04 / areas and links";
  decoderVersion: string;
  documentSchema: string;
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export type HuntSpawnsManifest = Readonly<{
  sourceGroup: "DATA-04 / hunt definitions";
  decoderVersion: string;
  documentSchema: string;
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export function buildAreasManifest(input: {
  files: readonly SourceFileRecord[];
  keys: readonly ArtifactKeyDigest[];
}): AreasManifest {
  const files = [...input.files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const filesDigest = sha256(files.map((file) => `${file.relativePath}:${file.digest}`).join("\n"));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: AREAS_DECODER_VERSION,
      documentSchema: AREAS_DOCUMENT_SCHEMA,
      filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "DATA-04 / areas and links",
    decoderVersion: AREAS_DECODER_VERSION,
    documentSchema: AREAS_DOCUMENT_SCHEMA,
    files,
    filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}

export function buildAreaLinksManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): AreaLinksManifest {
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: AREA_LINKS_DECODER_VERSION,
      filesDigest: input.filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "DATA-04 / areas and links",
    decoderVersion: AREA_LINKS_DECODER_VERSION,
    documentSchema: AREAS_DOCUMENT_SCHEMA,
    filesDigest: input.filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}

export function buildHuntSpawnsManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): HuntSpawnsManifest {
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: HUNT_SPAWNS_DECODER_VERSION,
      filesDigest: input.filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "DATA-04 / hunt definitions",
    decoderVersion: HUNT_SPAWNS_DECODER_VERSION,
    documentSchema: AREAS_DOCUMENT_SCHEMA,
    filesDigest: input.filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}
