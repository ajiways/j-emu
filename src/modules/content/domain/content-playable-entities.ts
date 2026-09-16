type ArtifactSkillDocument = Readonly<{ id: string; value: number; flags: number }>;

type ArtifactActionDocument = Readonly<{
  code: string;
  param1: number | string;
  param2: number | string;
  dispose: 0 | 1;
  title: string;
  bonusId: number;
  description: string;
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
  duration?: number;
  forceSelfTargeting?: boolean;
  realStartTime?: boolean;
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
  triggers?: unknown;
  onlyPvP?: unknown;
  effects: readonly ArtifactSpellEffectDocument[];
}>;

type ArtifactGloveSocketDocument = Readonly<{
  id?: number;
  cost: number;
  row: number;
  artikul_id0: number;
  artikul_id1?: number;
  artikul_id2?: number;
  artikul_id3?: number;
  artikul_id4?: number;
  artikul_id5?: number;
  artikul_id6?: number;
}>;

type ArtifactExtraDocument = Readonly<{
  spell?: ArtifactSpellDocument;
  spells?: readonly ArtifactGloveSocketDocument[];
  hits?: readonly number[];
  trend?: number;
  set?: ArtifactSetDocument;
  param1?: number;
  flagsExt?: number;
}>;

type ArtifactSetDocument = Readonly<{
  id: number;
  title: string;
  bonus1?: number;
  bonus2?: number;
  bonus3?: number;
  bonus4?: number;
  bonus5?: number;
  bonus6?: number;
  bonus7?: number;
  bonus8?: number;
  bonus9?: number;
  avatar_man: string;
  avatar_woman: string;
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
  durability: number;
  durabilityMax: number;
  skills: readonly ArtifactSkillDocument[];
  artifact_actions: Readonly<Record<string, ArtifactActionDocument>>;
  extra: ArtifactExtraDocument;
  fBody: string;
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

type BotLootEntryDocument = Readonly<{
  artikulId: number;
  dropWeight: number;
  countMin: number;
  countMax: number;
}>;

type BotSpellDocument = Readonly<{
  artikulId: number;
  slot: "fight_start" | "prefer" | "turn_roulette" | "never";
  weight: number;
  maxCasts: number | null;
  gate: "self_hp_le" | "once" | "foe_has_dispel_groups" | null;
  hpPct: number | null;
  spell: ArtifactSpellDocument;
}>;

type BotSpellBookDocument = Readonly<{
  nothingWeight: number;
  spells: readonly BotSpellDocument[];
}>;

export type BotDocument = Readonly<{
  id: number;
  title: string;
  level: number;
  maxHp: number;
  strength: number;
  hunt: HuntLookDocument;
  baseExp: number;
  moneyMin: number;
  moneyMax: number;
  lootDropCnt: number;
  lootBonusChance: number;
  lootBonusMin: number;
  lootBonusMax: number;
  lootNothingWeight: number;
  lootEntries: readonly BotLootEntryDocument[];
  spellBook: BotSpellBookDocument;
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
  bgId: string;
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

type HuntSpawnPointDocument = Readonly<{
  x: number;
  y: number;
}>;

type HuntSpawnRouteStopDocument = Readonly<{
  x: number;
  y: number;
  waitMin: number;
  waitMax: number;
}>;

export type HuntSpawnDocument = Readonly<{
  id: number;
  areaId: string;
  botId: number;
  x: number;
  y: number;
  huntMask: string;
  waitMin: number;
  waitMax: number;
  respawnTimeMin: number;
  respawnTimeMax: number;
  zone: readonly HuntSpawnPointDocument[];
  route: readonly HuntSpawnRouteStopDocument[];
}>;

export type StoreTypeDocument = Readonly<{
  areaId: string;
  typeId: number;
  title: string;
  ord: number;
}>;

type StoreLotPayDocument =
  | Readonly<{ currency: "gold"; amount: number }>
  | Readonly<{ currency: "diamond"; amount: number }>
  | Readonly<{ currency: "barter"; artikulId: number; count: number }>
  | Readonly<{
      currency: "bundle";
      gold: number;
      barter: readonly Readonly<{ artikulId: number; count: number }>[];
    }>;

type StoreLotRequireDocument =
  | Readonly<{ type: "RANK"; min: number }>
  | Readonly<{ type: "REPUTATION"; objectId: number; min: number }>
  | Readonly<{ type: "LEVEL"; min: number }>;

export type StoreLotDocument = Readonly<{
  areaId: string;
  lotId: number;
  artikulId: number;
  typeId: number;
  price: number;
  ord: number;
  pay: StoreLotPayDocument;
  requires?:
    | Readonly<{ all: readonly StoreLotRequireDocument[] }>
    | Readonly<{ any: readonly StoreLotRequireDocument[] }>;
}>;

export type ReputationTrackDocument = Readonly<{
  objectId: number;
  type: 2;
  title: string;
  image: string;
  unlockFlag: string;
}>;

export type BonusDocument = Readonly<{
  id: number;
  kind: "skill";
  skillId: string;
  delta: number;
  needValue: number;
  artikulId: number;
  title: string;
  chatMsg: string;
}>;

type UseScriptRequireDocument = Readonly<{ artikulId: number; count: number }>;

type UseScriptEffectDocument =
  | Readonly<{ type: "consume"; artikulId: number; count: number }>
  | Readonly<{ type: "grant"; artikulId: number; count: number }>
  | Readonly<{ type: "openDialog"; dialogKey: string; npcId: number }>;

export type UseScriptDocument = Readonly<{
  bonusId: number;
  require: readonly UseScriptRequireDocument[];
  failPlaque: string;
  effects: readonly UseScriptEffectDocument[];
}>;
