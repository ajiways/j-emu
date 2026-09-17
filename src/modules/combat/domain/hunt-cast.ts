import type { BattleEvent } from "./battle-event.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { pocketHealAmount, spellCharging, spellKind } from "./hunt-human-cast-state.ts";
import { applyPocketKind3, requirePocketOrb } from "./pocket-kind3-cast.ts";
import { pocketEffectUse } from "./pocket-effect-use.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { rageBonusPctFromFill } from "./rage-bonus.ts";
import { schoolOverlayFromKind1 } from "./school-overlay.ts";

export type KeepTurnResult =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{ kind: "resolved"; events: readonly BattleEvent[]; consumePocketItemId?: number }>;

export function tryPocketCast(
  human: HuntHuman,
  itemId: number,
  nowMs: number,
  sequence: string | number,
): KeepTurnResult {
  if (!human.authed || human.waiting || human.hp === 0) return { kind: "ignored" };
  const row = human.casts.pocketRow(itemId);
  if (!row) return { kind: "ignored" };
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

export function tryRageCast(human: HuntHuman): KeepTurnResult {
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
  const standing = human.effects.attachChargingKind3({
    sourceId: human.heroId,
    artikulId: 212,
    title: "Ярость",
    img: "rageeffect_2702.png",
    dmgType: 1,
    remainTurns: 1,
    groupId: 844,
  });
  return {
    kind: "resolved",
    events: [
      {
        type: "effect-use",
        artikulId: 212,
        animation: "fury",
        kind: 3,
        groupId: 844,
        flags: "0",
        img: standing.img,
        title: standing.title,
        persId: human.heroId,
        dmgType: 1,
        id: standing.id,
        sourceId: standing.sourceId,
        remainTime: 0,
        skills: { pcSTR },
      },
      fury,
    ],
  };
}

export function tryGloveKeepTurn(
  human: HuntHuman,
  spellId: number,
  sequence: string | number,
): KeepTurnResult {
  if (!human.authed || human.waiting || human.hp === 0) return { kind: "ignored" };
  const glove = human.casts.gloveSpell(spellId);
  if (!glove) return { kind: "ignored" };
  if (spellKind(glove.spell, 11)) throw new FightCastDenied("kind11", sequence);
  if (isEndingGlove(glove.spell)) return { kind: "ignored" };
  if (human.casts.cp < glove.cost) {
    return { kind: "resolved", events: [{ type: "pers-cp", cp: human.casts.cp }] };
  }
  const cp = human.casts.spendCombo(glove.cost);
  const overlay = schoolOverlayFromKind1(glove.spell, human.meleeStrength());
  if (overlay) {
    human.casts.schoolOverlay = overlay;
  } else {
    human.casts.armGloveCrit(spellCharging(glove.spell) || 1);
  }
  return {
    kind: "resolved",
    events: [
      {
        type: "effect-use",
        artikulId: glove.artikulId,
        animation: glove.spell.animData ?? "",
        kind: 3,
        flags: "262144",
        img: glove.picture,
        title: glove.title,
        persId: human.heroId,
      },
      {
        type: "buff-cast",
        animation: glove.spell.animData ?? "",
        sourceId: human.heroId,
        targetId: human.heroId,
        maxHp: human.maxHp,
      },
      { type: "pers-cp", cp },
    ],
  };
}

export function isEndingGlove(spell: CombatSpell): boolean {
  if (kind1OverlayCharges(spell) > 0) return false;
  return spell.endTurn === true || spellKind(spell, 1);
}
