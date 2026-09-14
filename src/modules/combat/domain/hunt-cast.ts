import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { CombatPocketRow, CombatSpell } from "./combat-loadout.ts";
import { kind1OverlayCharges, magicHitFromKind1, magicReact } from "./magic-hit.ts";
import { schoolOverlayFromKind1 } from "./school-overlay.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { pocketHealAmount, spellCharging, spellKind, spellPcStr } from "./hunt-human-cast-state.ts";
import { resolveMeleeTarget, type BotMeleePresence } from "./melee-target.ts";
import { applyDamageToMeleeTarget } from "./paired-melee.ts";
import { pocketSpellWireFlags } from "./pocket-spell-wire-flags.ts";
import type { RandomSource } from "./random-source.ts";

export type KeepTurnResult =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{ kind: "resolved"; events: readonly BattleEvent[]; consumePocketItemId?: number }>;

export type EndingGloveResult = Readonly<{
  kind: "ending";
  events: readonly BattleEvent[];
  hitBot: BotMeleePresence | null;
  finished: boolean;
}>;

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
    human.casts.armOrb(spellPcStr(consumed.spell), spellCharging(consumed.spell) || 1);
    return {
      kind: "resolved",
      consumePocketItemId: itemId,
      events: [
        pocketEffectUse(consumed, human.heroId, 3, 1),
        {
          type: "buff-cast",
          animation: consumed.spell.animData ?? "botles_strenght_grey",
          sourceId: human.heroId,
          targetId: human.heroId,
          maxHp: human.maxHp,
        },
      ],
    };
  }
  throw new Error(`Pocket artifact ${consumed.artifactId} has no supported fight effect`);
}

export function tryRageCast(human: HuntHuman): KeepTurnResult {
  if (!human.authed || human.waiting || human.hp === 0) return { kind: "ignored" };
  human.casts.spendRage();
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
        img: "rageeffect_2702.png",
        title: "Ярость",
        persId: human.heroId,
        dmgType: 1,
      },
      {
        type: "buff-cast",
        animation: "fury",
        sourceId: human.heroId,
        targetId: human.heroId,
        maxHp: human.maxHp,
      },
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

export function resolveGloveFinisher(
  human: HuntHuman,
  spellId: number,
  sequence: string | number,
  input: Readonly<{
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
    duel: FightDuel;
    nowMs: number;
  }>,
): KeepTurnResult | EndingGloveResult {
  if (!human.authed || input.finished) return { kind: "ignored" };
  const glove = human.casts.gloveSpell(spellId);
  if (!glove || !isEndingGlove(glove.spell)) return { kind: "ignored" };
  if (spellKind(glove.spell, 11)) throw new FightCastDenied("kind11", sequence);
  if (human.waiting || !human.turnActive) {
    return { kind: "resolved", events: [{ type: "pers-cp", cp: human.casts.cp }] };
  }
  if (human.casts.cp < glove.cost) {
    return { kind: "resolved", events: [{ type: "pers-cp", cp: human.casts.cp }] };
  }
  const target = resolveMeleeTarget({
    attackerHeroId: human.heroId,
    duel: input.duel,
    humans: input.humans,
    bots: input.bots,
  });
  human.endTurn();
  const cp = human.casts.spendCombo(glove.cost);
  const damage = magicHitFromKind1(
    glove.spell,
    human.meleeStrength(),
    human.mag,
    target.kind === "human" ? target.human.mag : target.mag,
    input.random,
    input.rules,
  );
  const hit = applyDamageToMeleeTarget(human, target, damage, {
    humans: input.humans,
    bots: input.bots,
  });
  const dmgType = glove.spell.effects.find((effect) => effect.kind === 1)?.dmgType;
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    {
      type: "damage",
      sourceId: human.heroId,
      targetId: hit.targetId,
      animation: glove.spell.animData ?? "magic_electroball",
      hpChange: -damage,
      targetMaxHp: hit.targetMaxHp,
      killed: hit.killed,
      comboCp: cp,
      ...(dmgType !== undefined ? { dmgType } : {}),
      react: magicReact(hit.killed),
    },
  ];
  for (const effectId of human.effects.onActorEndingTurn(input.nowMs)) {
    events.push({ type: "effect-purge", effectId });
  }
  if (hit.finished) {
    events.push({ type: "finished", winnerTeam: human.team, fightId: input.fightId });
  }
  return { kind: "ending", events, hitBot: hit.hitBot, finished: hit.finished };
}

function isEndingGlove(spell: CombatSpell): boolean {
  if (kind1OverlayCharges(spell) > 0) return false;
  return spell.endTurn === true || spellKind(spell, 1);
}

function pocketEffectUse(
  row: CombatPocketRow,
  persId: number,
  kind: number,
  dmgType?: number,
): BattleEvent {
  return {
    type: "effect-use",
    artikulId: row.artifactId,
    animation: row.spell.animData ?? "",
    kind,
    flags: pocketSpellWireFlags(row.spell.flags),
    img: row.picture,
    title: row.title,
    persId,
    ...(row.spell.groupId !== undefined ? { groupId: row.spell.groupId } : {}),
    ...(dmgType !== undefined ? { dmgType } : {}),
  };
}
