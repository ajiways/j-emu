export type PocketCellSnapshot = Readonly<{
  itemId: number;
  artifactId: number;
  position: number;
  startCount: number;
  currentCount: number;
}>;

export type FightHumanOutcome = Readonly<{
  accountId: number;
  characterId: number;
  team: 1 | 2;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  damageToBot: number;
  damageToHumans: number;
  /** The same damage split by the human who took it (heroism is rated per victim). */
  damageByVictim: readonly Readonly<{ victimId: number; damage: number }>[];
  /** Players he finished off with the blow that took their last hit points. */
  humanKills: number;
  /** The fighters he executed («Казнь»); a human among them pays double heroism. */
  executedVictimIds: readonly number[];
  /** What he healed in the other humans, by the one healed (heroism pays half of damage). */
  healedByTarget: readonly Readonly<{ targetId: number; amount: number }>[];
  leftLive: boolean;
  pocket: readonly PocketCellSnapshot[];
}>;

export type FightOutcomeKind = "win" | "loss" | "last-leave";

export type PracticeRestore = Readonly<{
  characterId: number;
  hp: number;
  mp: number;
  pocket: readonly PocketCellSnapshot[];
}>;

type HuntFightOutcomeSnapshot = Readonly<{
  mode: "hunt";
  fightId: string;
  botId: number;
  botLevel: number;
  winnerTeam: 1 | 2;
  kind: FightOutcomeKind;
  humans: readonly FightHumanOutcome[];
  /** What each allied mob (an idol's phantom, a scripted helper) dealt to the enemy mobs. */
  alliedBotDamage: readonly number[];
  /** The mob whose reward the fight pays fell to an execution: its experience and money double. */
  primaryExecuted: boolean;
}>;

export type PracticeFightOutcomeSnapshot = Readonly<{
  mode: "friendly-practice";
  fightId: string;
  winnerTeam: 1 | 2;
  kind: FightOutcomeKind;
  humans: readonly FightHumanOutcome[];
  restore: readonly PracticeRestore[];
}>;

export type PvpFightOutcomeSnapshot = Readonly<{
  mode: "pvp";
  fightId: string;
  winnerTeam: 1 | 2;
  kind: FightOutcomeKind;
  humans: readonly FightHumanOutcome[];
}>;

export type FightOutcomeSnapshot =
  HuntFightOutcomeSnapshot | PracticeFightOutcomeSnapshot | PvpFightOutcomeSnapshot;
