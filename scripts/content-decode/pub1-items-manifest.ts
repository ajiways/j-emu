import { createHash } from "node:crypto";
import { PUB1_ITEMS_DECODER_VERSION, PUB1_ITEMS_DOCUMENT_SCHEMA } from "./decoder-version.ts";

export type AmfFileRecord = Readonly<{
  relativePath: string;
  size: number;
  digest: string;
}>;

export type ArtifactKeyDigest = Readonly<{ key: string; digest: string }>;

export type Pub1ItemsManifest = Readonly<{
  sourceGroup: "DATA-02 / Pub1 base item artifacts";
  decoderVersion: string;
  documentSchema: string;
  fileCount: number;
  filesDigest: string;
  files: readonly AmfFileRecord[];
  weightsFile: string;
  weightsDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export function buildPub1ItemsManifest(input: {
  files: readonly AmfFileRecord[];
  weightsFile: string;
  weightsDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): Pub1ItemsManifest {
  const files = [...input.files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const filesDigest = sha256(files.map((file) => `${file.relativePath}:${file.digest}`).join("\n"));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: PUB1_ITEMS_DECODER_VERSION,
      documentSchema: PUB1_ITEMS_DOCUMENT_SCHEMA,
      filesDigest,
      weightsDigest: input.weightsDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "DATA-02 / Pub1 base item artifacts",
    decoderVersion: PUB1_ITEMS_DECODER_VERSION,
    documentSchema: PUB1_ITEMS_DOCUMENT_SCHEMA,
    fileCount: files.length,
    filesDigest,
    files,
    weightsFile: input.weightsFile,
    weightsDigest: input.weightsDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
