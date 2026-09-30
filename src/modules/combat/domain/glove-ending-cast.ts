import type { Roster } from "./roster.ts";
import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import { requirePvpForSpell } from "./pvp-only-spell.ts";
import { rosterIsPvp } from "./roster-pvp.ts";
import type { FightDuel } from "./fight-duel.ts";
import {
  pickSpellTargets,
  rollSpellDamage,
  spellAoeTargetCount,
  spellKind1IsAoe,
} from "./spell-aoe.ts";
import { advanceActionClock } from "./duel-clock.ts";
import { isEndingGlove, type KeepTurnResult } from "./player-casts.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { spellKind } from "./cast-state.ts";
import { magicReact } from "./magic-hit.ts";
import { duelFoe } from "./melee-target.ts";
import type { Participant } from "./participant.ts";
import { applyDamageToMeleeTarget } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";

type GloveSideNotify = Readonly<{
  accountId: number;
  events: readonly BattleEvent[];
  targetId: number;
}>;

export type EndingGloveResult = Readonly<{
  kind: "ending";
  events: readonly BattleEvent[];
  finished: boolean;
  hitTargetIds: readonly number[];
  sideNotifies: readonly GloveSideNotify[];
  selfKilled?: true;
}>;

export function resolveGloveFinisher(
  human: HumanFighter,
  spellId: number,
  sequence: string | number,
  input: Readonly<{
    finished: boolean;
    rules: BattleRules;
    random: RandomSource;
    fightId: string;
    roster: Roster;
    duel: FightDuel;
    duels: readonly FightDuel[];
    nowMs: number;
  }>,
): KeepTurnResult | EndingGloveResult {
  if (!human.authed || input.finished) return { kind: "ignored" };
  const glove = human.casts.gloveSpell(spellId);
  if (!glove || !isEndingGlove(glove.spell)) return { kind: "ignored" };
  requirePvpForSpell(glove.spell, rosterIsPvp(input.roster.humans), sequence);
  if (spellKind(glove.spell, 11)) throw new FightCastDenied("kind11", sequence);
  if (human.waiting || !human.turnActive) {
    return { kind: "resolved", events: [{ type: "pers-cp", cp: human.casts.cp }] };
  }
  if (human.casts.cp < glove.cost) {
    return { kind: "resolved", events: [{ type: "pers-cp", cp: human.casts.cp }] };
  }
  const everyone = input.roster.all();
  const primary = duelFoe(input.duel, everyone, human.id);
  const targets = spellKind1IsAoe(glove.spell)
    ? pickSpellTargets({
        primaryId: primary.id,
        enemies: livingEnemies(human, everyone),
        count: spellAoeTargetCount(glove.spell),
        random: input.random,
      })
    : [primary];
  const turnElapsedMs = human.turnElapsedMs(input.nowMs, input.rules.turnTimeoutSeconds);
  human.endTurn();
  human.noteAction();
  const cp = human.casts.spendCombo(glove.cost);
  const dmgType = glove.spell.effects.find((effect) => effect.kind === 1)?.dmgType;
  const hits = applyGloveKind1Hits(human, glove.spell, targets, {
    participants: everyone,
    random: input.random,
    rules: input.rules,
  });
  const primaryHit = hits[0];
  if (!primaryHit) throw new Error("Glove finisher has no primary hit");
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    gloveDamageEvent(human.heroId, glove.spell, primaryHit, cp, dmgType),
  ];
  let finished = hits.some((hit) => hit.finished);
  if (finished) {
    events.push({ type: "finished", winnerTeam: human.team, fightId: input.fightId });
  }
  let selfKilled = false;
  if (!finished) {
    const clock = advanceActionClock({
      attacker: human,
      victim: primary,
      victimKilledByHit: primaryHit.killed,
      turnElapsedMs,
      nowMs: input.nowMs,
      rules: input.rules,
      random: input.random,
      roster: input.roster,
      fightId: input.fightId,
    });
    events.push(...clock.events);
    finished = clock.finished;
    selfKilled = clock.selfKilled;
  }
  return {
    kind: "ending",
    events,
    finished,
    hitTargetIds: hits.map((hit) => hit.targetId),
    sideNotifies: sideNotifiesForHits(human, glove.spell, hits.slice(1), input, dmgType),
    ...(selfKilled ? { selfKilled: true as const } : {}),
  };
}

type GloveKind1Hit = Readonly<{
  targetId: number;
  targetMaxHp: number;
  hpChange: number;
  killed: boolean;
  finished: boolean;
}>;

function applyGloveKind1Hits(
  human: HumanFighter,
  spell: CombatSpell,
  targets: readonly Participant[],
  input: Readonly<{
    participants: readonly Participant[];
    random: RandomSource;
    rules: BattleRules;
  }>,
): readonly GloveKind1Hit[] {
  const hits: GloveKind1Hit[] = [];
  for (const target of targets) {
    const foeHp = target.hp;
    const damage = appliedHpLoss(
      rollSpellDamage({
        spell,
        casterStrength: human.meleeStrength(),
        caster: human,
        target,
        random: input.random,
        rules: input.rules,
      }),
      foeHp,
    );
    const hit = applyDamageToMeleeTarget(human, target, damage, input.participants);
    hits.push({
      targetId: hit.targetId,
      targetMaxHp: hit.targetMaxHp,
      hpChange: -damage,
      killed: hit.killed,
      finished: hit.finished,
    });
  }
  return hits;
}

function livingEnemies(
  caster: Participant,
  participants: readonly Participant[],
): readonly Participant[] {
  return participants.filter((entry) => entry.team !== caster.team && entry.alive);
}

function gloveDamageEvent(
  sourceId: number,
  spell: CombatSpell,
  hit: GloveKind1Hit,
  comboCp: number | undefined,
  dmgType: number | undefined,
): Extract<BattleEvent, { type: "damage" }> {
  return {
    type: "damage",
    sourceId,
    targetId: hit.targetId,
    animation: spell.animData ?? "magic_electroball",
    hpChange: hit.hpChange,
    targetMaxHp: hit.targetMaxHp,
    killed: hit.killed,
    ...(comboCp !== undefined ? { comboCp } : {}),
    ...(dmgType !== undefined ? { dmgType } : {}),
    react: magicReact(hit.killed),
  };
}

function sideNotifiesForHits(
  caster: HumanFighter,
  spell: CombatSpell,
  hits: readonly GloveKind1Hit[],
  input: Readonly<{
    rules: BattleRules;
    roster: Roster;
    duels: readonly FightDuel[];
  }>,
  dmgType: number | undefined,
): readonly GloveSideNotify[] {
  const notifies: GloveSideNotify[] = [];
  for (const hit of hits) {
    const damage = gloveDamageEvent(caster.heroId, spell, hit, undefined, dmgType);
    for (const accountId of notifyAccountIds(caster.accountId, hit.targetId, input)) {
      const events: BattleEvent[] = hit.killed
        ? [{ type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds }, damage]
        : [damage];
      notifies.push({ accountId, events, targetId: hit.targetId });
    }
  }
  return notifies;
}

function notifyAccountIds(
  casterAccountId: number,
  targetId: number,
  input: Readonly<{ roster: Roster; duels: readonly FightDuel[] }>,
): readonly number[] {
  const ids: number[] = [];
  for (const human of input.roster.humans) {
    if (human.accountId === casterAccountId || !human.authed) continue;
    if (human.heroId === targetId) {
      ids.push(human.accountId);
      continue;
    }
    const duel = input.duels.find((entry) => entry.has(human.heroId));
    if (duel && duel.otherId(human.heroId) === targetId) ids.push(human.accountId);
  }
  return ids;
}
