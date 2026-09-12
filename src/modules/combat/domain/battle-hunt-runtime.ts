import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { BotMeleePresence } from "./melee-target.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import type { RandomSource } from "./random-source.ts";

export function tickHuntRosterDuels(input: {
  roster: HuntRoster | null;
  finished: boolean;
  opener: HuntHuman;
  fightId: string;
  rules: BattleRules;
  random: RandomSource;
}): Readonly<{ events: readonly BattleEvent[]; finished: boolean }> {
  if (!input.roster || input.finished) return { events: [], finished: input.finished };
  const events = [...input.roster.tick(input.rules, input.random, input.fightId)];
  if (input.opener.hp === 0) {
    events.push({
      type: "finished",
      winnerTeam: input.roster.enemyTeam,
      fightId: input.fightId,
    });
    return { events, finished: true };
  }
  if (input.roster.enemySideCleared()) {
    events.push({
      type: "finished",
      winnerTeam: input.opener.team,
      fightId: input.fightId,
    });
    return { events, finished: true };
  }
  return { events, finished: false };
}

export function applyHuntPlayerHit(
  resolved: Readonly<{
    result: PlayerMeleeResult;
    hitBot: BotMeleePresence | null;
    finished: boolean;
  }>,
  input: Readonly<{
    roster: HuntRoster | null;
    duel: FightDuel;
    opener: HuntHuman;
  }>,
): Readonly<{ result: PlayerMeleeResult; finished: boolean }> {
  const extra = applyHuntBotHit(resolved.hitBot, resolved.finished, input);
  if (resolved.result.kind !== "resolved" || extra.events.length === 0) {
    return { result: resolved.result, finished: extra.finished };
  }
  return {
    result: { kind: "resolved", events: [...resolved.result.events, ...extra.events] },
    finished: extra.finished,
  };
}

export function applyHuntBotHit(
  hitBot: BotMeleePresence | null,
  finished: boolean,
  input: Readonly<{
    roster: HuntRoster | null;
    duel: FightDuel;
    opener: HuntHuman;
  }>,
): Readonly<{ events: readonly BattleEvent[]; finished: boolean }> {
  if (hitBot && input.roster) input.roster.applyPresence(hitBot);
  if (finished) return { events: [], finished: true };
  if (!hitBot || hitBot.hp > 0 || !input.roster) return { events: [], finished: false };
  const next = input.roster.takeNextEnemyForHuman(hitBot.fightId);
  if (!next) return { events: [], finished: false };
  input.duel.replace(hitBot.fightId, next.fightId);
  input.duel.resetHits();
  input.duel.setNextActor(input.opener.heroId);
  return { events: [{ type: "opponent-new", bot: next.snap() }], finished: false };
}
