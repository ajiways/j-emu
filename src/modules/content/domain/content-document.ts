export const PLAYABLE_SLICE_SCHEMA_VERSION = "playable-slice/v1";
export const CONTENT_VALIDATOR_VERSION = "1";

export type ArtifactDocument = Readonly<{
  id: number;
  title: string;
  picture: string;
  typeId: string;
  kindId: number;
  slotMask: number;
  weight: number;
}>;

export type BotDocument = Readonly<{
  id: number;
  title: string;
  level: number;
  maxHp: number;
  strength: number;
}>;

export type AreaDocument = Readonly<{
  id: string;
  title: string;
  map: string;
  fightBackground: string;
}>;

export type HuntSpawnDocument = Readonly<{
  id: string;
  areaId: string;
  botId: number;
  x: number;
  y: number;
}>;

export type ContentBundle = Readonly<{
  schemaVersion: string;
  artifacts: readonly ArtifactDocument[];
  bots: readonly BotDocument[];
  areas: readonly AreaDocument[];
  huntSpawns: readonly HuntSpawnDocument[];
}>;

export type ContentEntry = Readonly<{
  type: "artifact" | "bot" | "area" | "hunt_spawn";
  key: string;
  digest: string;
  document: ArtifactDocument | BotDocument | AreaDocument | HuntSpawnDocument;
}>;

export type ValidatedContentBundle = Readonly<{
  schemaVersion: string;
  validatorVersion: string;
  checksum: string;
  artifacts: readonly ArtifactDocument[];
  bots: readonly BotDocument[];
  areas: readonly AreaDocument[];
  huntSpawns: readonly HuntSpawnDocument[];
  entries: readonly ContentEntry[];
}>;

export type PublishedRelease = Readonly<{
  id: string;
  version: number;
  checksum: string;
}>;
