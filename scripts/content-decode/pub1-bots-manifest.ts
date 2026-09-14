import {
  PUB1_BOTS_DECODER_VERSION,
  PUB1_BOTS_DOCUMENT_SCHEMA,
  PUB1_BOT_LOOT_DECODER_VERSION,
  PUB1_BOT_SPELL_BOOKS_DECODER_VERSION,
} from "./decoder-version.ts";
import { sha256, type ArtifactKeyDigest } from "./pub1-items-manifest.ts";

export type SourceFileRecord = Readonly<{
  relativePath: string;
  size: number;
  digest: string;
}>;

export type Pub1BotsManifest = Readonly<{
  sourceGroup: "DATA-03 / bestiary and bot overlays";
  decoderVersion: string;
  documentSchema: string;
  files: readonly SourceFileRecord[];
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export type Pub1BotLootManifest = Readonly<{
  sourceGroup: "DATA-03 / base loot";
  decoderVersion: string;
  documentSchema: string;
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export type Pub1BotSpellBooksManifest = Readonly<{
  sourceGroup: "DATA-03 / spell definitions";
  decoderVersion: string;
  documentSchema: string;
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export function buildBotsManifest(input: {
  files: readonly SourceFileRecord[];
  keys: readonly ArtifactKeyDigest[];
}): Pub1BotsManifest {
  const files = [...input.files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const filesDigest = sha256(files.map((file) => `${file.relativePath}:${file.digest}`).join("\n"));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: PUB1_BOTS_DECODER_VERSION,
      documentSchema: PUB1_BOTS_DOCUMENT_SCHEMA,
      filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "DATA-03 / bestiary and bot overlays",
    decoderVersion: PUB1_BOTS_DECODER_VERSION,
    documentSchema: PUB1_BOTS_DOCUMENT_SCHEMA,
    files,
    filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}

export function buildBotLootManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): Pub1BotLootManifest {
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: PUB1_BOT_LOOT_DECODER_VERSION,
      filesDigest: input.filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "DATA-03 / base loot",
    decoderVersion: PUB1_BOT_LOOT_DECODER_VERSION,
    documentSchema: PUB1_BOTS_DOCUMENT_SCHEMA,
    filesDigest: input.filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}

export function buildBotSpellBooksManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): Pub1BotSpellBooksManifest {
  const keys = [...input.keys].sort((left, right) => left.key.localeCompare(right.key));
  const corpusDigest = sha256(
    JSON.stringify({
      decoderVersion: PUB1_BOT_SPELL_BOOKS_DECODER_VERSION,
      filesDigest: input.filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "DATA-03 / spell definitions",
    decoderVersion: PUB1_BOT_SPELL_BOOKS_DECODER_VERSION,
    documentSchema: PUB1_BOTS_DOCUMENT_SCHEMA,
    filesDigest: input.filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}

export function fileRecord(relativePath: string, bytes: Buffer): SourceFileRecord {
  return { relativePath, size: bytes.length, digest: sha256(bytes) };
}

export { sha256 };
export function digestOf(value: unknown): string {
  return sha256(JSON.stringify(value));
}
