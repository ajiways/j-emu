import { appliedHpLoss } from "./applied-hp-loss.ts";
import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { FightDuel } from "./fight-duel.ts";
import {
  aoeKind1Damage,
  gloveAoeTargetCount,
  gloveKind1IsAoe,
  pickGloveAoeTargets,
} from "./glove-aoe-targets.ts";
import { isEndingGlove, type KeepTurnResult } from "./hunt-cast.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { spellKind } from "./hunt-human-cast-state.ts";
import { magicHitFromKind1, magicReact } from "./magic-hit.ts";
import {
  botMeleeTarget,
  resolveMeleeTarget,
  targetHp,
  type BotMeleePresence,
  type MeleeTarget,
} from "./melee-target.ts";
import { applyDamageToMeleeTarget } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";

type GloveSideNotify = Readonly<{
  accountId: number;
  events: readonly BattleEvent[];
  hitBot: BotMeleePresence | null;
}>;

export type EndingGloveResult = Readonly<{
  kind: "ending";
  events: readonly BattleEvent[];
  hitBot: BotMeleePresence | null;
  finished: boolean;
  hitTargetIds: readonly number[];
  hitBots: readonly BotMeleePresence[];
  sideNotifies: readonly GloveSideNotify[];
}>;

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
    duels: readonly FightDuel[];
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
  const primary = resolveMeleeTarget({
    attackerHeroId: human.heroId,
    duel: input.duel,
    humans: input.humans,
    bots: input.bots,
  });
  const targets = gloveKind1IsAoe(glove.spell)
    ? pickGloveAoeTargets({
        caster: human,
        primary,
        humans: input.humans,
        bots: input.bots,
        count: gloveAoeTargetCount(glove.spell),
        random: input.random,
      })
    : [primary];
  human.endTurn();
  const cp = human.casts.spendCombo(glove.cost);
  const dmgType = glove.spell.effects.find((effect) => effect.kind === 1)?.dmgType;
  const hits = applyGloveKind1Hits(human, glove.spell, targets, {
    humans: input.humans,
    bots: input.bots,
    random: input.random,
    rules: input.rules,
  });
  const primaryHit = hits[0];
  if (!primaryHit) throw new Error("Glove finisher has no primary hit");
  const events: BattleEvent[] = [
    { type: "turn-wait", timeoutSeconds: input.rules.turnTimeoutSeconds },
    gloveDamageEvent(human.heroId, glove.spell, primaryHit, cp, dmgType),
  ];
  for (const effectId of human.effects.onActorEndingTurn(input.nowMs)) {
    events.push({ type: "effect-purge", effectId });
  }
  const finished = hits.some((hit) => hit.finished);
  if (finished) {
    events.push({ type: "finished", winnerTeam: human.team, fightId: input.fightId });
  }
  return {
    kind: "ending",
    events,
    hitBot: primaryHit.hitBot,
    finished,
    hitTargetIds: hits.map((hit) => hit.targetId),
    hitBots: hits.flatMap((hit) => (hit.hitBot ? [hit.hitBot] : [])),
    sideNotifies: sideNotifiesForHits(human, glove.spell, hits.slice(1), input, dmgType),
  };
}

type GloveKind1Hit = Readonly<{
  targetId: number;
  targetMaxHp: number;
  hpChange: number;
  killed: boolean;
  finished: boolean;
  hitBot: BotMeleePresence | null;
}>;

function applyGloveKind1Hits(
  human: HuntHuman,
  spell: CombatSpell,
  targets: readonly MeleeTarget[],
  input: Readonly<{
    humans: readonly HuntHuman[];
    bots: readonly BotMeleePresence[];
    random: RandomSource;
    rules: BattleRules;
  }>,
): readonly GloveKind1Hit[] {
  const aoe = gloveKind1IsAoe(spell);
  let bots = [...input.bots];
  const hits: GloveKind1Hit[] = [];
  for (const listed of targets) {
    const target = livingTarget(listed, bots);
    const foeMag = target.mag;
    const foeHp = targetHp(target);
    const full = magicHitFromKind1(
      spell,
      human.meleeStrength(),
      human.mag,
      foeMag,
      input.random,
      input.rules,
    );
    const damage = appliedHpLoss(aoe ? aoeKind1Damage(full) : full, foeHp);
    const hit = applyDamageToMeleeTarget(human, target, damage, { humans: input.humans, bots });
    if (hit.hitBot) {
      bots = bots.map((bot) => (bot.fightId === hit.hitBot?.fightId ? hit.hitBot : bot));
    }
    hits.push({
      targetId: hit.targetId,
      targetMaxHp: hit.targetMaxHp,
      hpChange: -damage,
      killed: hit.killed,
      finished: hit.finished,
      hitBot: hit.hitBot,
    });
  }
  return hits;
}

function livingTarget(listed: MeleeTarget, bots: readonly BotMeleePresence[]): MeleeTarget {
  if (listed.kind === "human") return listed;
  const bot = bots.find((entry) => entry.fightId === listed.id);
  if (!bot) throw new Error(`AOE bot ${listed.id} is missing from the roster`);
  return botMeleeTarget(bot);
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
  caster: HuntHuman,
  spell: CombatSpell,
  hits: readonly GloveKind1Hit[],
  input: Readonly<{
    rules: BattleRules;
    humans: readonly HuntHuman[];
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
      notifies.push({ accountId, events, hitBot: hit.hitBot });
    }
  }
  return notifies;
}

function notifyAccountIds(
  casterAccountId: number,
  targetId: number,
  input: Readonly<{ humans: readonly HuntHuman[]; duels: readonly FightDuel[] }>,
): readonly number[] {
  const ids: number[] = [];
  for (const human of input.humans) {
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
