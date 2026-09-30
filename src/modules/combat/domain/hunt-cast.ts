import type { BattleEvent } from "./battle-event.ts";
import type { CombatGloveSpell, CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import { requirePvpForSpell } from "./pvp-only-spell.ts";
import type { Fighter } from "./fighter.ts";
import { castGloveStun } from "./glove-stun-cast.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { pocketHealAmount, spellCharging, spellKind } from "./human-cast-state.ts";
import { applyPocketKind3, requirePocketOrb } from "./pocket-kind3-cast.ts";
import { castChargingBuff } from "./charging-buff-cast.ts";
import { pocketEffectUse } from "./pocket-effect-use.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { rageBonusPctFromFill } from "./rage-bonus.ts";
import { schoolOverlayFromKind1 } from "./school-overlay.ts";

export type KeepTurnResult =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{ kind: "resolved"; events: readonly BattleEvent[]; consumePocketItemId?: number }>;

export function tryPocketCast(
  human: HumanFighter,
  itemId: number,
  nowMs: number,
  sequence: string | number,
  pvp: boolean,
): KeepTurnResult {
  if (!human.authed || human.waiting || human.hp === 0) return { kind: "ignored" };
  const row = human.casts.pocketRow(itemId);
  if (!row) return { kind: "ignored" };
  requirePvpForSpell(row.spell, pvp, sequence);
  if (human.casts.cooldownLeftMs(itemId, nowMs) > 0) {
    throw new FightCastDenied("cooldown", sequence);
  }
  if (spellKind(row.spell, 11)) throw new FightCastDenied("kind11", sequence);
  if (spellKind(row.spell, 3)) requirePocketOrb(row);
  const consumed = human.casts.consumePocket(itemId, nowMs);
  if (spellKind(consumed.spell, 2)) {
    const healed = human.applyHeal(pocketHealAmount(consumed.spell, human.maxHp));
    return {
      kind: "resolved",
      consumePocketItemId: itemId,
      events: [
        pocketEffectUse(consumed, human.heroId, 2),
        {
          type: "damage",
          sourceId: human.heroId,
          targetId: human.heroId,
          animation: consumed.spell.animData ?? "botles_healself_grey",
          hpChange: healed,
          targetMaxHp: human.maxHp,
          killed: false,
        },
      ],
    };
  }
  if (spellKind(consumed.spell, 3)) {
    return {
      kind: "resolved",
      consumePocketItemId: itemId,
      events: applyPocketKind3(human, consumed),
    };
  }
  throw new Error(`Pocket artifact ${consumed.artifactId} has no supported fight effect`);
}

export function tryRageCast(human: HumanFighter): KeepTurnResult {
  if (!human.authed || human.waiting || human.hp === 0) return { kind: "ignored" };
  const fury = {
    type: "buff-cast" as const,
    animation: "fury",
    sourceId: human.heroId,
    targetId: human.heroId,
    maxHp: human.maxHp,
  };
  if (human.casts.hasRageBuff() || human.effects.snapshot().some((fx) => fx.artikulId === 212)) {
    return { kind: "resolved", events: [fury] };
  }
  const fill = human.casts.spendRage();
  const pcSTR = rageBonusPctFromFill(fill);
  if (pcSTR <= 0) return { kind: "resolved", events: [fury] };
  human.casts.armRage(pcSTR);
  return {
    kind: "resolved",
    events: castChargingBuff(human, {
      artikulId: 212,
      title: "Ярость",
      img: "rageeffect_2702.png",
      dmgType: 1,
      remainTurns: 1,
      groupId: 844,
      animation: "fury",
      flags: "0",
      remainTime: 0,
      skills: { pcSTR },
      castAnimation: "fury",
    }),
  };
}

export function tryGloveKeepTurn(
  human: HumanFighter,
  spellId: number,
  sequence: string | number,
  pvp: boolean,
  cast: Readonly<{ nowMs: number; foe: () => Fighter }>,
): KeepTurnResult {
  if (!human.authed || human.waiting || human.hp === 0) return { kind: "ignored" };
  const glove = human.casts.gloveSpell(spellId);
  if (!glove) return { kind: "ignored" };
  requirePvpForSpell(glove.spell, pvp, sequence);
  if (spellKind(glove.spell, 11)) throw new FightCastDenied("kind11", sequence);
  if (isEndingGlove(glove.spell)) return { kind: "ignored" };
  if (human.casts.cp < glove.cost) {
    return { kind: "resolved", events: [{ type: "pers-cp", cp: human.casts.cp }] };
  }
  if (spellKind(glove.spell, 18)) {
    return {
      kind: "resolved",
      events: castGloveStun(human, glove, cast.foe(), cast.nowMs, sequence),
    };
  }
  const cp = human.casts.spendCombo(glove.cost);
  const overlay = schoolOverlayFromKind1(glove.spell, human.meleeStrength());
  const charges = overlay ? overlay.charges : spellCharging(glove.spell) || 1;
  if (overlay) {
    human.casts.schoolOverlay = overlay;
  } else {
    human.casts.armGloveCrit(charges);
  }
  return {
    kind: "resolved",
    events: castChargingBuff(human, {
      artikulId: glove.artikulId,
      title: glove.title,
      img: glove.picture,
      dmgType: overlay ? overlay.dmgType : gloveDmgType(glove),
      remainTurns: charges,
      ...(glove.spell.groupId !== undefined ? { groupId: glove.spell.groupId } : {}),
      animation: glove.spell.animData ?? "",
      flags: "262144",
      castAnimation: glove.spell.animData ?? "",
      after: [{ type: "pers-cp", cp }],
    }),
  };
}

export function isEndingGlove(spell: CombatSpell): boolean {
  if (kind1OverlayCharges(spell) > 0) return false;
  return spell.endTurn === true || spellKind(spell, 1);
}

function gloveDmgType(glove: CombatGloveSpell): number {
  const dmgType = glove.spell.effects.find((effect) => effect.dmgType !== undefined)?.dmgType;
  if (dmgType === undefined) throw new Error(`Glove spell ${glove.artikulId} dmgType is required`);
  return dmgType;
}
