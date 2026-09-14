import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { FightDuel } from "./fight-duel.ts";
import { isHumanDuelInit } from "./battle-fighters.ts";
import { requireBattleHuman, requireBattleHuntRoster, requireHuntInit } from "./battle-lookups.ts";
import { requireDuelContaining } from "./try-pair-hunt-queues.ts";

function huntAuthenticateEvents(
  input: Readonly<{
    human: HuntHuman;
    allies: readonly HuntHuman[];
    init: HuntBattleInit;
    botHp: number;
    rosterBots: readonly HuntBotSnap[];
    humanOpponent: HuntHuman | null;
    nextActorId: number;
    resume: boolean;
    timeoutSeconds: number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  const { human } = input;
  if (!human.waiting && !input.resume && human.heroId === input.nextActorId) {
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
      bot: huntBotSnap(input.init, input.botHp),
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
      loadout: human.casts.loadout,
      heroEffects: human.effects.snapshot(),
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
    opponent: HuntHuman;
    nextActorId: number;
    timeoutSeconds: number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  const { human, opponent } = input;
  const appearance = opponent.appearance;
  if (!appearance) throw new Error("Friendly duel opponent appearance is required");
  if (human.heroId === input.nextActorId && !human.turnActive) {
    human.beginTurn(input.nowMs, input.timeoutSeconds);
  }
  const events: BattleEvent[] = [
    {
      type: "friendly-bootstrap",
      hero: human.snapshot(),
      opponent: opponent.snapshot(),
      opponentAppearance: appearance,
      cp: human.casts.cp,
      cpHits: human.casts.hits,
      rage: human.casts.rage,
      aggro: human.casts.aggro,
      loadout: human.casts.loadout,
      heroEffects: human.effects.snapshot(),
      opponentEffects: opponent.effects.snapshot(),
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
    init: HuntBattleInit | FriendlyDuelBattleInit;
    huntRoster: HuntRoster | null;
    timeoutSeconds: number;
    accountId: number;
    opponentAccountId: (accountId: number) => number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  if (input.finished) throw new Error("Cannot authenticate a finished battle");
  const human = requireBattleHuman(input.humans, input.accountId);
  if (human.authed) throw new Error("Fight session is already authenticated");
  const resume = human.takeResume();
  human.authed = true;
  if (isHumanDuelInit(input.init)) {
    return friendlyAuthenticateEvents({
      human,
      opponent: requireBattleHuman(input.humans, input.opponentAccountId(input.accountId)),
      nextActorId: requireDuelContaining(input.duels, human.heroId).nextActorId,
      timeoutSeconds: input.timeoutSeconds,
      nowMs: input.nowMs,
    });
  }
  const duel = input.duels.find((entry) => entry.has(human.heroId));
  const otherId = duel?.otherId(human.heroId);
  const humanOpponent =
    otherId === undefined ? null : (input.humans.find((entry) => entry.heroId === otherId) ?? null);
  const roster = requireBattleHuntRoster(input.huntRoster);
  return huntAuthenticateEvents({
    human,
    allies: input.humans,
    init: requireHuntInit(input.init),
    botHp: roster.primary.hp,
    rosterBots: roster.snaps(),
    humanOpponent,
    nextActorId: duel?.nextActorId ?? human.heroId,
    resume,
    timeoutSeconds: input.timeoutSeconds,
    nowMs: input.nowMs,
  });
}
