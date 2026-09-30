import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { FighterEffects } from "./fighter-effects.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { RandomSource } from "./random-source.ts";

/** Wire `cast.react` / nested `hpChange.react`. Legacy behavior from jgr `damage.ts`. */
const PHYSICAL_DMG_TYPE = 1;

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
  /** What a physical hit of `raw` becomes under what stands on the fighter (DFR, ADFR, DMG_AMP). */
  takePhysical: (raw: number) => number;
  /** `DR`: an absolute chance to dodge, used in place of the one the dexterity gives; 0 — none. */
  dodgeRate: number;
  /** `BR`: an absolute chance to block, on top of the one the block stat gives. */
  blockRate: number;
  /** What stands on the striker changes his usual crit chance (`pcCR`, `CRBonus`, `pcCRBonus`). */
  critMod: CritMod;
}>;

export type CritMod = Readonly<{
  /** `pcCR`: percent change of the usual crit chance. */
  pcCr: number;
  /** `CRBonus`: crit chance added in percentage points. */
  bonus: number;
  /** `pcCRBonus`: percent change of that added chance. */
  pcBonus: number;
}>;

export const NO_CRIT_MOD: CritMod = { pcCr: 0, bonus: 0, pcBonus: 0 };

function critModOf(effects: Pick<FighterEffects, "standingSkill">): CritMod {
  return {
    pcCr: effects.standingSkill("pcCR"),
    bonus: effects.standingSkill("CRBonus"),
    pcBonus: effects.standingSkill("pcCRBonus"),
  };
}

/** `BR` and `pcBR` (the «Прикрытие» skills) are the same absolute block chance. */
function blockRateOf(effects: Pick<FighterEffects, "standingMax">): number {
  return Math.max(effects.standingMax("BR"), effects.standingMax("pcBR"));
}

export type MeleeOutcome = Readonly<{
  applied: number;
  raw: number;
  react: number;
  blocked: number;
}>;

/** A bot has only strength of its own; its other stats come from the effects standing on it. */
export function strikeStatsFromBot(bot: BotFighter): StrikeStats {
  return {
    strength: bot.meleeStrength(),
    rage: bot.rageStat,
    dexterity: bot.dexterity,
    defense: bot.defense,
    block: bot.block,
    takePhysical: (raw) => bot.effects.takenDamage(raw, PHYSICAL_DMG_TYPE),
    dodgeRate: bot.effects.standingMax("DR"),
    blockRate: blockRateOf(bot.effects),
    critMod: critModOf(bot.effects),
  };
}

export function unpublishedBotStrikeStats(strength: number): StrikeStats {
  if (!Number.isInteger(strength) || strength < 1) {
    throw new Error("Bot strength must be a positive integer");
  }
  return {
    strength,
    rage: 0,
    dexterity: 0,
    defense: 0,
    block: 0,
    takePhysical: (raw) => raw,
    dodgeRate: 0,
    blockRate: 0,
    critMod: NO_CRIT_MOD,
  };
}

export function strikeStatsFromHuman(
  human: HumanFighter,
  strength = human.meleeStrength(),
): StrikeStats {
  return {
    strength,
    rage: human.rageStat,
    dexterity: human.dexterity,
    defense: human.defense,
    block: human.block,
    takePhysical: (raw) => human.effects.takenDamage(raw, PHYSICAL_DMG_TYPE),
    dodgeRate: human.effects.standingMax("DR"),
    blockRate: blockRateOf(human.effects),
    critMod: critModOf(human.effects),
  };
}

export function rollMeleeOutcome(
  input: Readonly<{
    baseDamage: number;
    attacker: StrikeStats;
    defender: StrikeStats;
    targetHp: number;
    forceCrit: boolean;
    /** Absolute crit chance of a charged effect (`CR` below 1); 0 — the usual roll. */
    critChance: number;
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
  const dodgeChance =
    input.defender.dodgeRate > 0
      ? Math.min(1, input.defender.dodgeRate)
      : effectiveDodgeChance(input.attacker.defense, input.defender.dexterity, input.rules);
  const blockChance =
    1 -
    (1 - blockChanceFromBlok(input.defender.block, input.rules)) *
      (1 - Math.min(1, input.defender.blockRate));
  const defense = rollDefense(dodgeChance, blockChance, input.random);
  if (defense === "dodge") {
    return { applied: 0, raw: 0, react: MELEE_REACT.dodge, blocked: 0 };
  }
  const crit =
    input.forceCrit ||
    (input.critChance > 0
      ? input.random.unit() < input.critChance
      : rollCrit(
          input.attacker.rage,
          input.defender.dexterity,
          input.attacker.critMod,
          input.random,
          input.rules,
        ));
  const preMit = Math.max(1, Math.round(input.baseDamage * (crit ? input.rules.critMult : 1)));
  const mit = effectiveMitigation(input.attacker.rage, input.defender.defense, crit, input.rules);
  const unheld = Math.max(1, Math.round(preMit * (1 - mit)));
  if (defense === "block") {
    return { applied: 0, raw: unheld, react: MELEE_REACT.hit, blocked: unheld };
  }
  const raw = input.defender.takePhysical(unheld);
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
  mod: CritMod,
  random: RandomSource,
  rules: BattleRules,
): boolean {
  const usual =
    effectiveCritChance(rage, defenderDexterity, rules) * Math.max(0, 1 + mod.pcCr / 100);
  const added = (mod.bonus / 100) * Math.max(0, 1 + mod.pcBonus / 100);
  const chance = Math.min(1, usual + added);
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
