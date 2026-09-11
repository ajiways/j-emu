type ArtifactSpellSkill = Readonly<{
  skillId: string;
  value: number;
}>;

export type ArtifactSpellEffect = Readonly<{
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
  skills?: readonly ArtifactSpellSkill[];
}>;

export type ArtifactSpell = Readonly<{
  animData?: string;
  groupId?: number;
  cooldown?: number;
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
}>;
