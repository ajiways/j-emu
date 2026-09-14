import { DUNGEONS_DECODER_VERSION, DUNGEONS_DOCUMENT_SCHEMA } from "./decoder-version.ts";
import { sha256, type ArtifactKeyDigest } from "./pub1-items-manifest.ts";
import type { SourceFileRecord } from "./pub1-bots-manifest.ts";

export type DungeonsManifest = Readonly<{
  sourceGroup: "POST-03 / dungeon corpus";
  decoderVersion: string;
  documentSchema: string;
  files: readonly SourceFileRecord[];
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export function buildDungeonsManifest(input: {
  files: readonly SourceFileRecord[];
  keys: readonly ArtifactKeyDigest[];
}): DungeonsManifest {
  const files = [...input.files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const filesDigest = sha256(files.map((file) => `${file.relativePath}:${file.digest}`).join("\n"));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: DUNGEONS_DECODER_VERSION,
      documentSchema: DUNGEONS_DOCUMENT_SCHEMA,
      filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "POST-03 / dungeon corpus",
    decoderVersion: DUNGEONS_DECODER_VERSION,
    documentSchema: DUNGEONS_DOCUMENT_SCHEMA,
    files,
    filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}
