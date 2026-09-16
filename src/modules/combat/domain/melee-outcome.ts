import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { RandomSource } from "./random-source.ts";

/** Wire `cast.react` / nested `hpChange.react`. Legacy behavior from jgr `damage.ts`. */
export const MELEE_REACT = {
  dodge: 1,
  hit: 2,
  crit: 6,
  kill: 10,
  critKill: 14,
} as const;

export type StrikeStats = Readonly<{
  strength: number;
  rage: number;
  dexterity: number;
  defense: number;
  block: number;
}>;

export type MeleeOutcome = Readonly<{
  applied: number;
  raw: number;
  react: number;
  blocked: number;
}>;

export function unpublishedBotStrikeStats(strength: number): StrikeStats {
  if (!Number.isInteger(strength) || strength < 1) {
    throw new Error("Bot strength must be a positive integer");
  }
  return { strength, rage: 0, dexterity: 0, defense: 0, block: 0 };
}

export function strikeStatsFromHuman(
  human: HuntHuman,
  strength = human.meleeStrength(),
): StrikeStats {
  return {
    strength,
    rage: human.rageStat,
    dexterity: human.dexterity,
    defense: human.defense,
    block: human.block,
  };
}

export function rollMeleeOutcome(
  input: Readonly<{
    baseDamage: number;
    attacker: StrikeStats;
    defender: StrikeStats;
    targetHp: number;
    forceCrit: boolean;
    random: RandomSource;
    rules: BattleRules;
  }>,
): MeleeOutcome {
  requireMeleeOutcomeRules(input.rules);
  requireStrikeStats(input.attacker, "Attacker");
  requireStrikeStats(input.defender, "Defender");
  if (!Number.isInteger(input.baseDamage) || input.baseDamage < 1) {
    throw new Error("Melee base damage must be a positive integer");
  }
  if (!Number.isInteger(input.targetHp) || input.targetHp < 0) {
    throw new Error("Melee target hp must be a non-negative integer");
  }
  const dodgeChance = effectiveDodgeChance(
    input.attacker.defense,
    input.defender.dexterity,
    input.rules,
  );
  const blockChance = blockChanceFromBlok(input.defender.block, input.rules);
  const defense = rollDefense(dodgeChance, blockChance, input.random);
  if (defense === "dodge") {
    return { applied: 0, raw: 0, react: MELEE_REACT.dodge, blocked: 0 };
  }
  const crit =
    input.forceCrit ||
    rollCrit(input.attacker.rage, input.defender.dexterity, input.random, input.rules);
  const preMit = Math.max(1, Math.round(input.baseDamage * (crit ? input.rules.critMult : 1)));
  const mit = effectiveMitigation(input.attacker.rage, input.defender.defense, crit, input.rules);
  const raw = Math.max(1, Math.round(preMit * (1 - mit)));
  if (defense === "block") {
    return { applied: 0, raw, react: MELEE_REACT.hit, blocked: raw };
  }
  const applied = appliedHpLoss(raw, input.targetHp);
  if (applied > 0 && applied >= input.targetHp) {
    return {
      applied,
      raw,
      react: crit ? MELEE_REACT.critKill : MELEE_REACT.kill,
      blocked: 0,
    };
  }
  return {
    applied,
    raw,
    react: crit ? MELEE_REACT.crit : MELEE_REACT.hit,
    blocked: 0,
  };
}

function requireMeleeOutcomeRules(rules: BattleRules): void {
  requirePositive(rules.combatSoftC, "combatSoftC");
  requireUnitCap(rules.combatChanceCap, "combatChanceCap");
  if (!(rules.critMult > 1) || Number.isNaN(rules.critMult)) {
    throw new Error("critMult must be greater than 1");
  }
  requirePositive(rules.blockSoftC, "blockSoftC");
  requireUnitCap(rules.blockChanceCap, "blockChanceCap");
  requireUnitCap(rules.ragChokesDef, "ragChokesDef");
  requireUnitCap(rules.dexChokesRag, "dexChokesRag");
  requireUnitCap(rules.defChokesDex, "defChokesDex");
}

function rollDefense(
  dodgeChance: number,
  blockChance: number,
  random: RandomSource,
): "dodge" | "block" | null {
  if (dodgeChance + blockChance <= 0) return null;
  const roll = random.unit();
  if (roll < dodgeChance) return "dodge";
  if (roll < dodgeChance + blockChance) return "block";
  return null;
}

function rollCrit(
  rage: number,
  defenderDexterity: number,
  random: RandomSource,
  rules: BattleRules,
): boolean {
  const chance = effectiveCritChance(rage, defenderDexterity, rules);
  if (chance <= 0) return false;
  return random.unit() < chance;
}

function effectiveDodgeChance(
  attackerDefense: number,
  defenderDexterity: number,
  rules: BattleRules,
): number {
  const raw = combatChance(defenderDexterity, rules);
  return raw * (1 - chokeFrac(attackerDefense, defenderDexterity, rules.defChokesDex, rules));
}

function effectiveCritChance(
  attackerRage: number,
  defenderDexterity: number,
  rules: BattleRules,
): number {
  const raw = combatChance(attackerRage, rules);
  return raw * (1 - chokeFrac(defenderDexterity, attackerRage, rules.dexChokesRag, rules));
}

function effectiveMitigation(
  attackerRage: number,
  defenderDefense: number,
  isCrit: boolean,
  rules: BattleRules,
): number {
  const raw = combatChance(defenderDefense, rules);
  if (!isCrit) return raw;
  return raw * (1 - chokeFrac(attackerRage, defenderDefense, rules.ragChokesDef, rules));
}

function blockChanceFromBlok(block: number, rules: BattleRules): number {
  return softChance(block, rules.blockSoftC, rules.blockChanceCap);
}

function combatChance(stat: number, rules: BattleRules): number {
  return softChance(stat, rules.combatSoftC, rules.combatChanceCap);
}

function chokeFrac(src: number, resist: number, strength: number, rules: BattleRules): number {
  if (strength <= 0) return 0;
  const ratio = src / (src + resist + rules.combatSoftC * 0.25);
  return Math.min(strength, ratio * strength * 1.35);
}

function softChance(value: number, softC: number, cap: number): number {
  if (value < 0) throw new Error("Combat chance stat must be non-negative");
  if (value === 0) return 0;
  return Math.min(cap, value / (value + softC));
}

function requireStrikeStats(stats: StrikeStats, label: string): void {
  if (!Number.isInteger(stats.strength) || stats.strength < 1) {
    throw new Error(`${label} strength must be a positive integer`);
  }
  requireNonNegative(stats.rage, `${label} rage`);
  requireNonNegative(stats.dexterity, `${label} dexterity`);
  requireNonNegative(stats.defense, `${label} defense`);
  requireNonNegative(stats.block, `${label} block`);
}

function requireNonNegative(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function requirePositive(value: number, label: string): void {
  if (!(value > 0) || Number.isNaN(value)) throw new Error(`${label} must be positive`);
}

function requireUnitCap(value: number, label: string): void {
  if (!(value > 0) || value > 1 || Number.isNaN(value)) {
    throw new Error(`${label} must be in (0, 1]`);
  }
}
