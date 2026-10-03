import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { CombatEmblem } from "./combat-loadout.ts";
import { emblemPlanOf, type EmblemCondition, type EmblemPlan } from "./emblem-plan.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { RandomSource } from "./random-source.ts";
import { castTimedSpell, isTimedBuff } from "./timed-spell.ts";

/**
 * The start of a hero's turn: each emblem he wears that has not used up its firings checks its
 * trigger groups and, when one holds, puts its shield (and any buffs of the card) on him. Nothing
 * happens outside a fight against other players when the card says `onlyPvP`.
 */
export function fireEmblems(
  input: Readonly<{
    human: HumanFighter;
    pvp: boolean;
    nowMs: number;
    random: RandomSource;
    rules: BattleRules;
  }>,
): readonly BattleEvent[] {
  const { human } = input;
  if (human.hp < 1) return [];
  const events: BattleEvent[] = [];
  for (const emblem of human.casts.loadout.emblems) {
    const planned = emblemPlanOf(emblem);
    if (planned.kind === "unsupported") continue;
    const { plan } = planned;
    if (plan.onlyPvP && !input.pvp) continue;
    if (human.casts.emblemFired(emblem.artikulId) >= plan.triggerCount) continue;
    if (!triggers(plan, human, input.random, input.rules)) continue;
    human.casts.noteEmblemFired(emblem.artikulId);
    events.push(...cast(emblem, plan, human, input.nowMs));
  }
  return events;
}

function triggers(
  plan: EmblemPlan,
  human: HumanFighter,
  random: RandomSource,
  rules: BattleRules,
): boolean {
  return plan.groups.some((group) => {
    // The conditions that need no roll go first: a failed one must not spend a roll.
    const rolls = group.filter((condition) => condition.type === "randomly");
    const states = group.filter((condition) => condition.type !== "randomly");
    return (
      states.every((condition) => stateHolds(condition, human)) &&
      rolls.every((condition) => rollHolds(condition, random, rules))
    );
  });
}

function stateHolds(condition: EmblemCondition, human: HumanFighter): boolean {
  if (condition.type === "lowSelfHP") {
    return human.hp * 100 < condition.belowPct * human.maxHp === condition.expectation;
  }
  // The trigger is checked at the start of the hero's own turn: he is the active side.
  if (condition.type === "selfActive") return condition.expectation;
  throw new Error(`Emblem condition ${condition.type} is not a state`);
}

function rollHolds(condition: EmblemCondition, random: RandomSource, rules: BattleRules): boolean {
  if (condition.type !== "randomly")
    throw new Error(`Emblem condition ${condition.type} is not a roll`);
  const chance = rules.emblemChances[condition.probability - 1];
  if (chance === undefined) {
    throw new Error(`Emblem probability ${condition.probability} has no chance in the rules`);
  }
  return random.unit() < chance === condition.expectation;
}

function cast(
  emblem: CombatEmblem,
  plan: EmblemPlan,
  human: HumanFighter,
  nowMs: number,
): readonly BattleEvent[] {
  const { spell } = emblem;
  const events: BattleEvent[] = [
    {
      type: "buff-cast",
      animation: spell.animData ?? "",
      sourceId: human.id,
      targetId: human.id,
      maxHp: human.maxHp,
    },
  ];
  const capacity = Math.floor(plan.shield.abs + plan.shield.proc * emblem.power);
  if (capacity >= 1) {
    const standing = human.effects.attachShield({
      sourceId: human.id,
      artikulId: emblem.artikulId,
      title: emblem.title,
      img: emblem.picture,
      dmgType: plan.shield.dmgType,
      ...(spell.groupId !== undefined ? { groupId: spell.groupId } : {}),
      capacity,
      mask: plan.shield.mask,
      limitPct: plan.shield.limitPct,
    });
    events.push({
      type: "effect-use",
      artikulId: emblem.artikulId,
      animation: "",
      kind: 9,
      flags: 0,
      img: standing.img,
      title: standing.title,
      persId: human.id,
      dmgType: standing.dmgType,
      id: standing.id,
      sourceId: standing.sourceId,
      ...(standing.groupId !== undefined ? { groupId: standing.groupId } : {}),
      ...(standing.amount !== undefined ? { amount: standing.amount } : {}),
    });
  }
  if (plan.hasTimedBuffs) {
    events.push(
      ...castTimedSpell(
        human,
        human,
        {
          artikulId: emblem.artikulId,
          title: emblem.title,
          picture: emblem.picture,
          spell: { ...spell, effects: spell.effects.filter(isTimedBuff) },
          flags: 0,
        },
        nowMs,
        false,
      ),
    );
  }
  return events;
}
