import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { FightEffectSnap } from "./hunt-human-fight-effects.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { FightDuel } from "./fight-duel.ts";
import { requireBattleHuman, requireBattleHuntRoster } from "./battle-lookups.ts";

function huntAuthenticateEvents(
  input: Readonly<{
    human: HuntHuman;
    allies: readonly HuntHuman[];
    bot: HuntBotSnap;
    rosterBots: readonly HuntBotSnap[];
    botEffects: readonly FightEffectSnap[];
    humanOpponent: HuntHuman | null;
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
      heroEffects: human.effects.snapshot(),
      botEffects: input.botEffects,
      otherEffects: standingEffectsOf(
        input.allies.filter((entry) => entry.accountId !== human.accountId),
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
    human: HuntHuman;
    allies: readonly HuntHuman[];
    opponent?: HuntHuman;
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
            opponentEffects: opponent.effects.snapshot(),
          }
        : {}),
      cp: human.casts.cp,
      cpHits: human.casts.hits,
      rage: human.casts.rage,
      aggro: human.casts.aggro,
      loadout: human.casts.wireLoadout(),
      heroEffects: human.effects.snapshot(),
      otherEffects: standingEffectsOf(input.allies),
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
    humans: readonly HuntHuman[];
    duels: readonly FightDuel[];
    huntRoster: HuntRoster | null;
    timeoutSeconds: number;
    accountId: number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  if (input.finished) throw new Error("Cannot authenticate a finished battle");
  const human = requireBattleHuman(input.humans, input.accountId);
  if (human.authed) throw new Error("Fight session is already authenticated");
  const resume = human.takeResume();
  human.authed = true;
  if (input.huntRoster === null) {
    const duel = input.duels.find((entry) => entry.has(human.heroId));
    const opponent =
      duel === undefined
        ? undefined
        : input.humans.find((entry) => entry.heroId === duel.otherId(human.heroId));
    if (!human.waiting && opponent === undefined) {
      throw new Error("Paired human duel fighter is missing an opponent");
    }
    return friendlyAuthenticateEvents({
      human,
      allies: input.humans.filter(
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
    otherId === undefined ? null : (input.humans.find((entry) => entry.heroId === otherId) ?? null);
  const roster = requireBattleHuntRoster(input.huntRoster);
  const pairedBot = otherId !== undefined && humanOpponent === null ? roster.bot(otherId) : null;
  const bot = pairedBot
    ? pairedBot.snap()
    : huntBotSnap(roster.primary, roster.primary.hp, roster.enemyTeam);
  return huntAuthenticateEvents({
    human,
    allies: input.humans,
    bot,
    rosterBots: roster.snaps(),
    botEffects: pairedBot ? pairedBot.effects.snapshot() : [],
    humanOpponent,
    nextActorId: duel?.nextActorId ?? human.heroId,
    resume,
    timeoutSeconds: input.timeoutSeconds,
    nowMs: input.nowMs,
  });
}

function standingEffectsOf(humans: readonly HuntHuman[]) {
  return humans.map((entry) => ({
    persId: entry.heroId,
    effects: entry.effects.snapshot(),
  }));
}
