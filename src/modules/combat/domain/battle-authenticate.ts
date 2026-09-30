import type { Roster } from "./roster.ts";
import type { BattleEvent, BotSnap } from "./battle-event.ts";
import { botSnapOf } from "./bot-snap-of.ts";
import { primaryEnemyBot, requireFightBot } from "./fight-bots.ts";
import type { FightEffectSnap } from "./standing-effect.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { FightDuel } from "./fight-duel.ts";
import { requireBattleHuman } from "./battle-lookups.ts";
import { rosterIsPvp } from "./roster-pvp.ts";

function huntAuthenticateEvents(
  input: Readonly<{
    human: HumanFighter;
    allies: readonly HumanFighter[];
    bot: BotSnap;
    rosterBots: readonly BotSnap[];
    botEffects: readonly FightEffectSnap[];
    humanOpponent: HumanFighter | null;
    pvp: boolean;
    nextActorId: number;
    resume: boolean;
    timeoutSeconds: number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  const { human } = input;
  if (!human.waiting && !input.resume && human.heroId === input.nextActorId && !human.turnActive) {
    human.beginTurn(input.nowMs, input.timeoutSeconds);
  }
  const opponent = input.humanOpponent;
  const events: BattleEvent[] = [
    {
      type: "hunt-bootstrap",
      waiting: human.waiting,
      pvp: input.pvp,
      ...(input.resume && !human.waiting ? { resumePaired: true as const } : {}),
      hero: human.snapshot(),
      allies: input.allies
        .filter((entry) => entry.accountId !== human.accountId)
        .map((entry) => entry.snapshot()),
      bot: input.bot,
      ...(opponent
        ? {
            humanOpponent: opponent.snapshot(),
            humanOpponentAppearance: opponent.appearance,
          }
        : {}),
      rosterBots: input.rosterBots,
      cp: human.casts.cp,
      cpHits: human.casts.hits,
      rage: human.casts.rage,
      aggro: human.casts.aggro,
      loadout: human.casts.wireLoadout(),
      heroEffects: human.effects.snapshot(input.nowMs),
      botEffects: input.botEffects,
      otherEffects: standingEffectsOf(
        input.allies.filter((entry) => entry.accountId !== human.accountId),
        input.nowMs,
      ),
    },
  ];
  if (!human.waiting && human.turnActive) {
    const restTime = input.resume ? human.remainingTurnSeconds(input.nowMs) : input.timeoutSeconds;
    if (restTime === null) throw new Error("Paired hunter is missing a turn deadline");
    events.push({ type: "turn-granted", timeoutSeconds: restTime });
  }
  return events;
}

function friendlyAuthenticateEvents(
  input: Readonly<{
    human: HumanFighter;
    allies: readonly HumanFighter[];
    opponent?: HumanFighter;
    nextActorId?: number;
    timeoutSeconds: number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  const { human, opponent } = input;
  if (!human.waiting) {
    if (!opponent) throw new Error("Paired human duel fighter is missing an opponent");
    if (input.nextActorId === undefined) {
      throw new Error("Paired human duel is missing next actor");
    }
    if (!opponent.appearance) throw new Error("Friendly duel opponent appearance is required");
    if (human.heroId === input.nextActorId && !human.turnActive) {
      human.beginTurn(input.nowMs, input.timeoutSeconds);
    }
  }
  const events: BattleEvent[] = [
    {
      type: "friendly-bootstrap",
      waiting: human.waiting,
      hero: human.snapshot(),
      allies: input.allies.map((entry) => entry.snapshot()),
      ...(opponent && opponent.appearance
        ? {
            opponent: opponent.snapshot(),
            opponentAppearance: opponent.appearance,
            opponentEffects: opponent.effects.snapshot(input.nowMs),
          }
        : {}),
      cp: human.casts.cp,
      cpHits: human.casts.hits,
      rage: human.casts.rage,
      aggro: human.casts.aggro,
      loadout: human.casts.wireLoadout(),
      heroEffects: human.effects.snapshot(input.nowMs),
      otherEffects: standingEffectsOf(input.allies, input.nowMs),
    },
  ];
  if (human.turnActive) {
    events.push({ type: "turn-granted", timeoutSeconds: input.timeoutSeconds });
  }
  return events;
}

export function authenticateFighter(
  input: Readonly<{
    finished: boolean;
    roster: Roster;
    duels: readonly FightDuel[];
    enemyTeam: 1 | 2;
    timeoutSeconds: number;
    accountId: number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  if (input.finished) throw new Error("Cannot authenticate a finished battle");
  const human = requireBattleHuman(input.roster.humans, input.accountId);
  if (human.authed) throw new Error("Fight session is already authenticated");
  const resume = human.takeResume();
  human.authed = true;
  if (input.roster.bots.length === 0) {
    const duel = input.duels.find((entry) => entry.has(human.heroId));
    const opponent =
      duel === undefined
        ? undefined
        : input.roster.humans.find((entry) => entry.heroId === duel.otherId(human.heroId));
    if (!human.waiting && opponent === undefined) {
      throw new Error("Paired human duel fighter is missing an opponent");
    }
    return friendlyAuthenticateEvents({
      human,
      allies: input.roster.humans.filter(
        (entry) => entry.heroId !== human.heroId && entry.heroId !== opponent?.heroId,
      ),
      ...(opponent ? { opponent } : {}),
      ...(duel ? { nextActorId: duel.nextActorId } : {}),
      timeoutSeconds: input.timeoutSeconds,
      nowMs: input.nowMs,
    });
  }
  const duel = input.duels.find((entry) => entry.has(human.heroId));
  const otherId = duel?.otherId(human.heroId);
  const humanOpponent =
    otherId === undefined
      ? null
      : (input.roster.humans.find((entry) => entry.heroId === otherId) ?? null);
  const pairedBot =
    otherId !== undefined && humanOpponent === null
      ? requireFightBot(input.roster.bots, otherId)
      : null;
  const primary = primaryEnemyBot(input.roster.bots, input.enemyTeam);
  const bot = pairedBot ? pairedBot.snap() : botSnapOf(primary, primary.hp, input.enemyTeam);
  return huntAuthenticateEvents({
    human,
    allies: input.roster.humans,
    bot,
    rosterBots: input.roster.bots.map((entry) => entry.snap()),
    botEffects: pairedBot ? pairedBot.effects.snapshot(input.nowMs) : [],
    humanOpponent,
    pvp: rosterIsPvp(input.roster.humans),
    nextActorId: duel?.nextActorId ?? human.heroId,
    resume,
    timeoutSeconds: input.timeoutSeconds,
    nowMs: input.nowMs,
  });
}

function standingEffectsOf(humans: readonly HumanFighter[], nowMs: number) {
  return humans.map((entry) => ({
    persId: entry.heroId,
    effects: entry.effects.snapshot(nowMs),
  }));
}
