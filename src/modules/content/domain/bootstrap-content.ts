export const COMMON_CONF_REQUIRED_KEYS = [
  "status",
  "gag_reason_info",
  "kind_info",
  "rank_info",
  "money_info",
  "loot_type_info",
  "quality_info",
  "fight_level_info",
  "great_fight_k1",
  "great_fight_k2",
  "profession_info",
  "assistant_tactics_info",
  "SEAL_PERCENT_COMMON",
  "skill_groups",
  "level_table",
  "rank_table",
  "restriction_modules",
  "HAPPY_BIRTHDAY_DESCRIPTION",
  "HAPPY_BIRTHDAY_IMAGE",
  "HAPPY_BIRTHDAY_PAYMENT_PERCENT",
  "macros_list",
] as const;

export type CommonConfBlock = Readonly<{
  status: 100;
  gag_reason_info: unknown;
  kind_info: unknown;
  rank_info: unknown;
  money_info: unknown;
  loot_type_info: unknown;
  quality_info: unknown;
  fight_level_info: unknown;
  great_fight_k1: unknown;
  great_fight_k2: unknown;
  profession_info: unknown;
  assistant_tactics_info: unknown;
  SEAL_PERCENT_COMMON: unknown;
  skill_groups: unknown;
  level_table: unknown;
  rank_table: unknown;
  restriction_modules: unknown;
  HAPPY_BIRTHDAY_DESCRIPTION: unknown;
  HAPPY_BIRTHDAY_IMAGE: unknown;
  HAPPY_BIRTHDAY_PAYMENT_PERCENT: unknown;
  macros_list: unknown;
}>;

export type SkillDocument = Readonly<{
  id: string;
  title: string;
  group: string;
  order: string;
  weight: string;
  image: string;
  valueKind: "number" | "string";
}>;

type ManagedSkillDocument = Readonly<{
  id: string;
  value: number;
}>;

export type LevelBoundaryDocument = Readonly<{
  level: number;
  expMin: number;
  expMax: number;
  bagCnt: number;
  honorRank: number;
  honorMin: number;
  honorMax: number;
  honorStatus: number;
  managedSkills: readonly ManagedSkillDocument[];
  evidenceKind: "confirmed" | "legacy_extrapolated";
}>;

export type AppearanceDocument = Readonly<{
  kind: number;
  gender: number;
  avatarBig: string;
  avatarSmall: string;
}>;

export type HudDefaultsDocument = Readonly<{
  fightId: number;
  gagTime: number;
  mpTime: number;
  epicValue: number;
  expStatus: number;
  revenge: number;
  revengeMin: number;
  revengeMax: string;
  revengeStatus: number;
  energyPercentMax: number;
  energyPercentCurrent: number;
  injuryTime: number;
  injuryArtikulId: number;
}>;

export const BOOTSTRAP_CHROME_REQUIRED_KEYS = [
  "user|professions",
  "pet|list",
  "user|mount_list",
  "user|campaigns",
  "chat|area_population",
  "friend|info",
  "user|action_stats",
  "arena|great_fights",
  "user|time_to_next_achievement",
  "assistant|farm_info",
  "bank|info",
  "user|smiles",
  "common|antimat",
  "common|event_conf",
  "common|front_status",
  "common|area_capture_info",
  "common|occurrences_conf",
  "common|farm_agregate",
] as const;

export type BootstrapChromeDocument = Readonly<
  Record<(typeof BOOTSTRAP_CHROME_REQUIRED_KEYS)[number], unknown>
>;

export type WelcomeMessageDocument = Readonly<{
  template: string;
}>;
