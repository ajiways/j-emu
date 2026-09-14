import { UNPUBLISHED_MAG_STATS, requireMagStats, type MagStats } from "./mag-stats.ts";

export type CombatantFightStats = Readonly<{
  strength: number;
  initiative: number;
  rage: number;
  dexterity: number;
  defense: number;
  block: number;
  aggroCharges: number;
  mag: MagStats;
}>;

/** Unpublished `BotDefinition` has no LUCK/RAG/DEX/DEF/BLOK. Named policy, not STR-as-luck. */
const UNPUBLISHED_BOT_SECONDARIES = {
  initiative: 0,
  rage: 0,
  dexterity: 0,
  defense: 0,
  block: 0,
  aggroCharges: 0,
  mag: UNPUBLISHED_MAG_STATS,
} as const;

function requireCombatantFightStats(stats: CombatantFightStats, label: string): void {
  if (!Number.isInteger(stats.strength) || stats.strength < 1) {
    throw new Error(`${label} strength must be a positive integer`);
  }
  requireNonNegativeStat(stats.initiative, `${label} initiative`);
  requireNonNegativeStat(stats.rage, `${label} rage`);
  requireNonNegativeStat(stats.dexterity, `${label} dexterity`);
  requireNonNegativeStat(stats.defense, `${label} defense`);
  requireNonNegativeStat(stats.block, `${label} block`);
  requireNonNegativeStat(stats.aggroCharges, `${label} aggro charges`);
  requireMagStats(stats.mag, label);
}

export function unpublishedBotFightStats(strength: number): CombatantFightStats {
  if (!Number.isInteger(strength) || strength < 1) {
    throw new Error("Bot strength must be a positive integer");
  }
  return { strength, ...UNPUBLISHED_BOT_SECONDARIES };
}

export function huntHeroStatFields(stats: CombatantFightStats): Readonly<{
  heroStrength: number;
  heroInitiative: number;
  heroRage: number;
  heroDexterity: number;
  heroDefense: number;
  heroBlock: number;
  heroAggroCharges: number;
  heroMagPower: number;
  heroMagResist: number;
}> {
  requireCombatantFightStats(stats, "Hero");
  return {
    heroStrength: stats.strength,
    heroInitiative: stats.initiative,
    heroRage: stats.rage,
    heroDexterity: stats.dexterity,
    heroDefense: stats.defense,
    heroBlock: stats.block,
    heroAggroCharges: stats.aggroCharges,
    heroMagPower: stats.mag.power,
    heroMagResist: stats.mag.resist,
  };
}

function requireNonNegativeStat(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}
