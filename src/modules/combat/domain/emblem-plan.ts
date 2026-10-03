import type { CombatEmblem } from "./combat-loadout.ts";

/** One condition of a trigger group (`spell.triggers[].conditions[]` of an emblem card). */
export type EmblemCondition =
  | Readonly<{ type: "randomly"; probability: number; expectation: boolean }>
  | Readonly<{ type: "lowSelfHP"; belowPct: number; expectation: boolean }>
  | Readonly<{ type: "selfActive"; expectation: boolean }>;

/** How an emblem works in a fight: when it fires, how often, and what the shield is. */
export type EmblemPlan = Readonly<{
  /** The emblem fires when every condition of any one group holds. */
  groups: readonly (readonly EmblemCondition[])[];
  triggerCount: number;
  onlyPvP: boolean;
  /** The shield: its size is `abs + proc × PVP_SHIELD`, it holds `limitPct` of a hit. */
  shield: Readonly<{ abs: number; proc: number; limitPct: number; mask: number; dmgType: number }>;
  /** The timed buffs that ride on the cast, kind 3 effects of the same card. */
  hasTimedBuffs: boolean;
}>;

export type EmblemPlanResult =
  Readonly<{ kind: "plan"; plan: EmblemPlan }> | Readonly<{ kind: "unsupported"; reason: string }>;

const POWER_SKILL = "PVP_SHIELD";

/**
 * Reads the card of an emblem. Only the family that gives a `PVP_SHIELD` shield on hit-point
 * conditions is played; anything else (seals with cooldowns, damage effects) is reported as
 * unsupported and does nothing in the fight.
 */
export function emblemPlanOf(emblem: CombatEmblem): EmblemPlanResult {
  const { spell } = emblem;
  const shields = spell.effects.filter((effect) => effect.kind === 9);
  const shield = shields[0];
  if (shields.length !== 1 || !shield) return unsupported("needs exactly one shield effect");
  if (spell.effects.some((effect) => effect.kind !== 9 && effect.kind !== 3)) {
    return unsupported("has an effect that is neither a shield nor a buff");
  }
  const delta = shield.delta;
  if (!delta || delta.skill !== POWER_SKILL) return unsupported(`shield is not ${POWER_SKILL}`);
  if (shield.duration !== undefined) return unsupported("shield has a duration");
  const limitPct = limitPercent(shield.limit);
  if (limitPct === null) return unsupported("shield limit is not a share");
  if (shield.dmgMask === undefined) return unsupported("shield has no damage mask");
  const groups = groupsOf(spell.triggers);
  if (typeof groups === "string") return unsupported(groups);
  return {
    kind: "plan",
    plan: {
      groups,
      triggerCount: spell.triggerCount ?? 1,
      onlyPvP: spell.onlyPvP === true,
      shield: {
        abs: delta.abs ?? 0,
        proc: delta.proc ?? 1,
        limitPct,
        mask: shield.dmgMask,
        dmgType: shield.dmgType ?? 0,
      },
      hasTimedBuffs: spell.effects.some((effect) => effect.kind === 3),
    },
  };
}

function unsupported(reason: string): EmblemPlanResult {
  return { kind: "unsupported", reason };
}

/** `limit` is a share of a hit in percent: `100` or `"100%"`. */
function limitPercent(limit: number | string | undefined): number | null {
  const value = typeof limit === "string" ? Number(limit.replace("%", "")) : limit;
  if (value === undefined || !Number.isFinite(value) || value < 1 || value > 100) return null;
  return value;
}

function groupsOf(triggers: unknown): readonly (readonly EmblemCondition[])[] | string {
  if (!Array.isArray(triggers) || triggers.length < 1) return "has no triggers";
  const groups: EmblemCondition[][] = [];
  for (const trigger of triggers) {
    const rows = (trigger as { conditions?: unknown } | null)?.conditions;
    if (!Array.isArray(rows) || rows.length < 1) return "has a trigger without conditions";
    const conditions: EmblemCondition[] = [];
    for (const row of rows) {
      const condition = conditionOf(row);
      if (condition === null)
        return `has a trigger condition it does not know: ${JSON.stringify(row)}`;
      conditions.push(condition);
    }
    groups.push(conditions);
  }
  return groups;
}

function conditionOf(row: unknown): EmblemCondition | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const expectation = record.expectation;
  if (typeof expectation !== "boolean") return null;
  if (record.type === "randomly" && Number.isInteger(record.probability)) {
    return { type: "randomly", probability: record.probability as number, expectation };
  }
  if (record.type === "lowSelfHP" && typeof record.hpLevel === "string") {
    const pct = Number(record.hpLevel.replace("%", ""));
    return Number.isFinite(pct) ? { type: "lowSelfHP", belowPct: pct, expectation } : null;
  }
  if (record.type === "selfActive") return { type: "selfActive", expectation };
  return null;
}
