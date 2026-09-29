type ArtifactSpellSkill = Readonly<{
  skillId: string;
  value: number;
}>;

type ArtifactSpellDelta = Readonly<{
  skill: string;
  abs?: number;
  proc?: number;
  target?: boolean;
}>;

type ArtifactSpellSkillPair = Readonly<{
  skill1: string;
  skill2: string;
  abs: number;
  proc: number;
}>;

export type ArtifactSpellEffect = Readonly<{
  kind: number;
  amount?: number | string;
  dmgType?: number;
  dmgMask?: number;
  charging?: number;
  capacity?: number;
  order?: number;
  hidden?: number;
  targetCount?: number;
  targetGroups?: readonly number[];
  targetEffectGroupId?: number;
  targetEffectCount?: number;
  botArtikulId?: number;
  duration?: number;
  period?: number;
  forceSelfTargeting?: boolean;
  realStartTime?: boolean;
  durationInTurns?: boolean;
  noHasten?: boolean;
  chargable?: boolean;
  dontPutoffAfterDeath?: boolean;
  animData?: string;
  manaCost?: number;
  limit?: number | string;
  useSkill?: string;
  delta?: ArtifactSpellDelta;
  skills?: readonly ArtifactSpellSkill[];
  skills2?: readonly ArtifactSpellSkillPair[];
}>;

export type ArtifactSpell = Readonly<{
  animData?: string;
  groupId?: number;
  cooldown?: number;
  mpCost?: number;
  triggerCount?: number;
  needConfirm?: boolean;
  endTurn?: boolean;
  flags?: string;
  persRestr?: Readonly<Record<string, unknown>>;
  targetRestr?: Readonly<Record<string, unknown>>;
  triggers?: unknown;
  onlyPvP?: unknown;
  effects: readonly ArtifactSpellEffect[];
}>;

export type ArtifactGloveSocket = Readonly<{
  cost: number;
  row: number;
  artikulId0: number;
  pool: readonly number[];
}>;
