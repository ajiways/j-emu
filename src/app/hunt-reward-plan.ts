import type { BotDefinition } from "../modules/catalog/domain/bot-definition.ts";
import type {
  FightHumanOutcome,
  FightOutcomeSnapshot,
  HuntMobOutcome,
} from "../modules/combat/domain/fight-outcome-snapshot.ts";
import { goldToMinor, rollMoneyGold } from "../modules/combat/domain/fight-money.ts";
import {
  overlevel,
  scaleMoneyReward,
  worldLootAllowed,
} from "../modules/combat/domain/overlevel.ts";
import type { RandomSource } from "../modules/combat/domain/random-source.ts";
import { rollBotLoot } from "../modules/combat/domain/roll-bot-loot.ts";
import {
  rewardedTopDamager,
  splitFightExperience,
  type DamageShare,
} from "../modules/combat/domain/split-fight-experience.ts";
import type { FightLootRoute } from "../modules/combat/ports/fight-loot-routing.ts";
import { splitMinorUnits } from "../modules/combat/domain/split-minor-units.ts";

/** The experience and the money of a mob that fell to an execution count twice; its drops do not. */
const EXECUTION_REWARD_MULTIPLIER = 2;

export type HuntOutcome = Extract<FightOutcomeSnapshot, { mode: "hunt" }>;
export type Drop = Readonly<{ artikulId: number; quantity: number }>;

/** What the fall of one mob pays before it is split among the party: one roll per mob. */
export type MobRewardRoll = Readonly<{
  experience: ReadonlyMap<number, number>;
  /** The human who dealt the most damage to the mob, `undefined` when an allied mob outdid every human. */
  top: DamageShare | undefined;
  moneyMinor: number;
  rolled: readonly Drop[];
}>;

/**
 * The experience, money and drops of one mob that fell in a won hunt, rolled from the level of the
 * human who dealt the most to it. An execution doubles the experience and the money only when the
 * executioner is that top damager: the reward condition holds for him, and the execution does not
 * waive it.
 */
export function rollMobReward(
  input: Readonly<{
    bot: BotDefinition;
    mob: HuntMobOutcome;
    rewarded: readonly FightHumanOutcome[];
    random: RandomSource;
  }>,
): MobRewardRoll {
  const { bot, mob, rewarded, random } = input;
  const dealt = new Map(mob.damageByHuman.map((row) => [row.characterId, row.damage]));
  const shares = rewarded.map((human) => {
    const damage = dealt.get(human.characterId);
    if (damage === undefined) {
      throw new Error(`Mob ${mob.botId} outcome lacks the damage of hero ${human.characterId}`);
    }
    return { characterId: human.characterId, damage, level: human.level };
  });
  const top = rewardedTopDamager(shares, mob.alliedDamage);
  const doubled =
    top !== undefined && mob.executedBy === top.characterId ? EXECUTION_REWARD_MULTIPLIER : 1;
  const experience = new Map(
    [...splitFightExperience(bot.reward.baseExp, mob.level, shares, mob.alliedDamage)].map(
      ([characterId, amount]) => [characterId, amount * doubled],
    ),
  );
  if (!top) return { experience, top, moneyMinor: 0, rolled: [] };
  const over = overlevel(top.level, mob.level);
  const moneyMinor =
    doubled *
    goldToMinor(
      scaleMoneyReward(rollMoneyGold(bot.reward.moneyMin, bot.reward.moneyMax, random), over),
    );
  return {
    experience,
    top,
    moneyMinor,
    rolled: worldLootAllowed(over) ? rollBotLoot(bot.reward, random) : [],
  };
}

/** How the party loot rules cut the roll: who gets the money and whether the items wait in the bag. */
export type PartyCut = Readonly<{
  /** The top damager fights in a party that has loot rules. */
  topInParty: boolean;
  partyMoneyMinor: number;
  /** Rules 2 and 3: the items go to the party bag, not to the top damager. */
  deferItems: boolean;
  /** Everyone of the party who fought, in the order of the outcome. */
  partyFighters: readonly FightHumanOutcome[];
  /** Rule 1: the money split evenly among the fighters of the party. */
  moneyShares: readonly number[] | null;
}>;

export function cutForParty(
  input: Readonly<{
    route: FightLootRoute | null;
    humans: readonly FightHumanOutcome[];
    top: DamageShare | undefined;
    moneyMinor: number;
    rolledCount: number;
  }>,
): PartyCut {
  const { route, top, moneyMinor } = input;
  const topInParty = Boolean(top && route?.memberCharacterIds.has(top.characterId));
  const deferItems = Boolean(
    route &&
    (route.lootRules === "2" || route.lootRules === "3") &&
    topInParty &&
    input.rolledCount > 0,
  );
  const partyFighters = route
    ? input.humans.filter((human) => route.memberCharacterIds.has(human.characterId))
    : [];
  const split =
    route?.lootRules === "1" && partyFighters.length > 1 && topInParty && moneyMinor > 0;
  return {
    topInParty,
    partyMoneyMinor: topInParty ? moneyMinor : 0,
    deferItems,
    partyFighters,
    moneyShares: split ? splitMinorUnits(moneyMinor, partyFighters.length) : null,
  };
}

/** The gold a human gets: his split share, else the whole sum when he is the top damager. */
export function goldMinorOf(
  input: Readonly<{
    characterId: number;
    isTop: boolean;
    moneyMinor: number;
    cut: PartyCut;
  }>,
): number {
  const { cut } = input;
  if (cut.moneyShares) {
    const index = cut.partyFighters.findIndex((row) => row.characterId === input.characterId);
    return index >= 0 ? (cut.moneyShares[index] ?? 0) : 0;
  }
  return input.isTop ? input.moneyMinor : 0;
}
