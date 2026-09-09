import type {
  AppearanceDocument,
  BootstrapChromeDocument,
  CommonConfBlock,
  HudDefaultsDocument,
  LevelBoundaryDocument,
  SkillDocument,
  WelcomeMessageDocument,
} from "./bootstrap-content.ts";

export const PLAYABLE_SLICE_SCHEMA_VERSION = "playable-slice/v11";
export const CONTENT_VALIDATOR_VERSION = "11";

type ArtifactSkillDocument = Readonly<{
  id: string;
  value: number;
  flags: number;
}>;

type ArtifactActionDocument = Readonly<{
  code: string;
  param1: number;
  param2: number;
  dispose: 0 | 1;
  title: string;
}>;

type ArtifactSpellSkillDocument = Readonly<{
  skill_id: string;
  value: number;
}>;

type ArtifactSpellEffectDocument = Readonly<{
  kind: number;
  amount?: number | string;
  dmgType?: number;
  charging?: number;
  capacity?: number;
  order?: number;
  hidden?: number;
  targetCount?: number;
  skills?: readonly ArtifactSpellSkillDocument[];
}>;

type ArtifactSpellDocument = Readonly<{
  animData?: string;
  groupId?: number;
  cooldown?: number;
  endTurn?: boolean;
  flags?: string | number;
  persRestr?: Readonly<Record<string, unknown>>;
  targetRestr?: Readonly<Record<string, unknown>>;
  effects: readonly ArtifactSpellEffectDocument[];
}>;

type ArtifactGloveSocketDocument = Readonly<{
  id?: number;
  cost: number;
  row: number;
  artikul_id0: number;
}>;

type ArtifactExtraDocument = Readonly<{
  spell?: ArtifactSpellDocument;
  spells?: readonly ArtifactGloveSocketDocument[];
  hits?: readonly number[];
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
  artifact_actions: Readonly<Record<string, ArtifactActionDocument>>;
  extra: ArtifactExtraDocument;
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
  sk: string;
  body: string;
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
  parentId: string;
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

type AreaLinkHrefDocument = Readonly<{
  object: "common";
  action: "action";
  form: Readonly<{ code: "COME_IN"; area_id: number }>;
}>;

export type AreaLinkDocument = Readonly<{
  fromAreaId: string;
  itemId: number;
  toAreaId: string;
  title: string;
  picture: string;
  description: string;
  flags: number;
  direction: number;
  confirmQuestion: "";
  toId: string;
  href: AreaLinkHrefDocument;
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
  areaLinks: readonly AreaLinkDocument[];
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
    | "area_link"
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
    | AreaLinkDocument
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
  areaLinks: readonly AreaLinkDocument[];
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
