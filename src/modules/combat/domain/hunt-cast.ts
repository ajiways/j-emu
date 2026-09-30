import type { BattleEvent } from "./battle-event.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import { requirePvpForSpell } from "./pvp-only-spell.ts";
import type { Fighter } from "./fighter.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { spellKind } from "./cast-state.ts";
import { requirePocketOrb } from "./pocket-kind3-cast.ts";
import { castSpell, type SpellPresentation } from "./spell-cast.ts";
import { castChargingBuff } from "./charging-buff-cast.ts";
import { isTimedSpell } from "./timed-spell.ts";
import { pocketSpellWireFlags } from "./pocket-spell-wire-flags.ts";
import { kind1OverlayCharges } from "./magic-hit.ts";
import { rageBonusPctFromFill } from "./rage-bonus.ts";
import { NO_STRIKE_MODS } from "./strike-mods.ts";

/** Live pocket elixirs: announced by their own `effUse`, always drunk by oneself, no trailing cast. */
const POCKET_PRESENTATION: SpellPresentation = {
  healAnimation: "botles_healself_grey",
  effectAnimation: "",
  castAnimation: "botles_strenght_grey",
  announceHeal: true,
  timedTrailingCast: false,
  selfOnly: true,
};

const GLOVE_PRESENTATION: SpellPresentation = {
  healAnimation: null,
  effectAnimation: "",
  castAnimation: "",
  announceHeal: false,
  timedTrailingCast: false,
  selfOnly: false,
};

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
  if (spellKind(row.spell, 3) && !isTimedSpell(row.spell)) requirePocketOrb(row);
  const consumed = human.casts.consumePocket(itemId, nowMs);
  const events = castSpell({
    caster: human,
    foe: () => {
      throw new Error("A pocket item is used on oneself and has no foe");
    },
    source: {
      artikulId: consumed.artifactId,
      title: consumed.title,
      picture: consumed.picture,
      spell: consumed.spell,
      flags: pocketSpellWireFlags(consumed.spell.flags),
    },
    nowMs,
    presentation: POCKET_PRESENTATION,
    endsTurn: false,
  });
  if (events === null) {
    throw new Error(`Pocket artifact ${consumed.artifactId} has no supported fight effect`);
  }
  return { kind: "resolved", consumePocketItemId: itemId, events };
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
  if (human.effects.snapshot().some((fx) => fx.artikulId === 212)) {
    return { kind: "resolved", events: [fury] };
  }
  const fill = human.casts.spendRage();
  const pcSTR = rageBonusPctFromFill(fill);
  if (pcSTR <= 0) return { kind: "resolved", events: [fury] };
  return {
    kind: "resolved",
    events: castChargingBuff(human, {
      artikulId: 212,
      title: "Ярость",
      img: "rageeffect_2702.png",
      dmgType: 1,
      remainTurns: 1,
      strike: { ...NO_STRIKE_MODS, pcStr: pcSTR },
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
  if (human.casts.gloveCooldownLeftMs(glove, cast.nowMs) > 0) {
    throw new FightCastDenied("cooldown", sequence);
  }
  const events = castSpell({
    caster: human,
    foe: cast.foe,
    source: {
      artikulId: glove.artikulId,
      title: glove.title,
      picture: glove.picture,
      spell: glove.spell,
      flags: "262144",
    },
    nowMs: cast.nowMs,
    presentation: GLOVE_PRESENTATION,
    endsTurn: false,
  });
  if (events === null) throw new Error(`Glove spell ${glove.artikulId} is not a keep-turn spell`);
  const cp = human.casts.spendCombo(glove.cost);
  human.casts.noteGloveUse(glove, cast.nowMs);
  return { kind: "resolved", events: [...events, { type: "pers-cp", cp }] };
}

export function isEndingGlove(spell: CombatSpell): boolean {
  if (kind1OverlayCharges(spell) > 0) return false;
  return spell.endTurn === true || spellKind(spell, 1);
}
