import type {
  AppearanceDocument,
  BootstrapChromeDocument,
  CommonConfBlock,
  HudDefaultsDocument,
  LevelBoundaryDocument,
  SkillDocument,
  WelcomeMessageDocument,
} from "./bootstrap-content.ts";

export const PLAYABLE_SLICE_SCHEMA_VERSION = "playable-slice/v7";
export const CONTENT_VALIDATOR_VERSION = "7";

type ArtifactSkillDocument = Readonly<{
  id: string;
  value: number;
  flags: number;
}>;

export type ArtifactDocument = Readonly<{
  id: number;
  title: string;
  picture: string;
  typeId: string;
  kindId: number;
  slotMask: number;
  weight: number;
  levelMin: number;
  levelMax: number;
  gender: number;
  priceMinor: number;
  flags: number;
  bagStack: number;
  skills: readonly ArtifactSkillDocument[];
}>;

type HuntLookDocument = Readonly<{
  nick: string;
  swf: string;
  scale: number;
  fps: number;
  speed: number;
  avatar: string;
  kind: number;
  hideOnMap: number;
}>;

export type BotDocument = Readonly<{
  id: number;
  title: string;
  level: number;
  maxHp: number;
  strength: number;
  hunt: HuntLookDocument;
}>;

export type AreaDocument = Readonly<{
  id: string;
  title: string;
  map: string;
  fightBackground: string;
  regionMap: string;
  ftimeMax: number;
  code: string;
  context: string;
  soundIntro: string;
  soundBg: string;
  instArtikulId: number;
  haveTradeChannel: number;
  haveKindChannel: number;
  hideFinishedFights: number;
  hideRunningFights: number;
  noClanChat: number;
}>;

export type HuntSpawnDocument = Readonly<{
  id: number;
  areaId: string;
  botId: number;
  x: number;
  y: number;
  huntMask: string;
}>;

export type ContentBundle = Readonly<{
  schemaVersion: string;
  artifacts: readonly ArtifactDocument[];
  bots: readonly BotDocument[];
  areas: readonly AreaDocument[];
  huntSpawns: readonly HuntSpawnDocument[];
  skills: readonly SkillDocument[];
  levels: readonly LevelBoundaryDocument[];
  appearances: readonly AppearanceDocument[];
  hudDefaults: HudDefaultsDocument;
  chrome: BootstrapChromeDocument;
  commonConf: CommonConfBlock;
  welcomeMessage: WelcomeMessageDocument;
}>;

export type ContentEntry = Readonly<{
  type:
    | "artifact"
    | "bot"
    | "area"
    | "hunt_spawn"
    | "skill"
    | "level"
    | "appearance"
    | "hud_defaults"
    | "chrome"
    | "common_conf"
    | "welcome_message";
  key: string;
  digest: string;
  document:
    | ArtifactDocument
    | BotDocument
    | AreaDocument
    | HuntSpawnDocument
    | SkillDocument
    | LevelBoundaryDocument
    | AppearanceDocument
    | HudDefaultsDocument
    | BootstrapChromeDocument
    | CommonConfBlock
    | WelcomeMessageDocument;
}>;

export type ValidatedContentBundle = Readonly<{
  schemaVersion: string;
  validatorVersion: string;
  checksum: string;
  artifacts: readonly ArtifactDocument[];
  bots: readonly BotDocument[];
  areas: readonly AreaDocument[];
  huntSpawns: readonly HuntSpawnDocument[];
  skills: readonly SkillDocument[];
  levels: readonly LevelBoundaryDocument[];
  appearances: readonly AppearanceDocument[];
  hudDefaults: HudDefaultsDocument;
  chrome: BootstrapChromeDocument;
  commonConf: CommonConfBlock;
  welcomeMessage: WelcomeMessageDocument;
  entries: readonly ContentEntry[];
}>;

export type PublishedRelease = Readonly<{
  id: string;
  version: number;
  checksum: string;
}>;
