import {
  AREA_FARMS_DECODER_VERSION,
  ASSISTANT_TYPES_DECODER_VERSION,
  CRAFT_RECIPES_DECODER_VERSION,
  FARM_RESOURCES_DECODER_VERSION,
  PROFESSIONS_DOCUMENT_SCHEMA,
} from "./decoder-version.ts";
import { sha256, type ArtifactKeyDigest } from "./pub1-items-manifest.ts";
import type { SourceFileRecord } from "./pub1-bots-manifest.ts";

export type ProfessionsManifest = Readonly<{
  sourceGroup: "POST-02 / professions assistants farms recipes";
  decoderVersion: string;
  documentSchema: string;
  files?: readonly SourceFileRecord[];
  filesDigest: string;
  acceptedCount: number;
  keys: readonly ArtifactKeyDigest[];
  corpusDigest: string;
}>;

export function buildAssistantTypesManifest(input: {
  files: readonly SourceFileRecord[];
  keys: readonly ArtifactKeyDigest[];
}): ProfessionsManifest {
  return buildManifest({
    decoderVersion: ASSISTANT_TYPES_DECODER_VERSION,
    files: input.files,
    keys: input.keys,
  });
}

export function buildFarmResourcesManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): ProfessionsManifest {
  return buildManifest({
    decoderVersion: FARM_RESOURCES_DECODER_VERSION,
    filesDigest: input.filesDigest,
    keys: input.keys,
  });
}

export function buildAreaFarmsManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): ProfessionsManifest {
  return buildManifest({
    decoderVersion: AREA_FARMS_DECODER_VERSION,
    filesDigest: input.filesDigest,
    keys: input.keys,
  });
}

export function buildCraftRecipesManifest(input: {
  filesDigest: string;
  keys: readonly ArtifactKeyDigest[];
}): ProfessionsManifest {
  return buildManifest({
    decoderVersion: CRAFT_RECIPES_DECODER_VERSION,
    filesDigest: input.filesDigest,
    keys: input.keys,
  });
}

function buildManifest(input: {
  decoderVersion: string;
  files?: readonly SourceFileRecord[];
  filesDigest?: string;
  keys: readonly ArtifactKeyDigest[];
}): ProfessionsManifest {
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
      documentSchema: PROFESSIONS_DOCUMENT_SCHEMA,
      filesDigest,
      keys,
    }),
  );
  return {
    sourceGroup: "POST-02 / professions assistants farms recipes",
    decoderVersion: input.decoderVersion,
    documentSchema: PROFESSIONS_DOCUMENT_SCHEMA,
    ...(files ? { files } : {}),
    filesDigest,
    acceptedCount: keys.length,
    keys,
    corpusDigest,
  };
}
