import type { BattleEvent } from "./battle-event.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function huntAuthenticateEvents(
  input: Readonly<{
    human: HuntHuman;
    allies: readonly HuntHuman[];
    init: HuntBattleInit;
    botHp: number;
    resume: boolean;
    timeoutSeconds: number;
    nowMs: number;
  }>,
): readonly BattleEvent[] {
  const { human } = input;
  if (!human.waiting && !input.resume) human.beginTurn(input.nowMs, input.timeoutSeconds);
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
      cp: human.casts.cp,
      cpHits: human.casts.hits,
      rage: human.casts.rage,
      aggro: human.casts.aggro,
      loadout: human.casts.loadout,
    },
  ];
  if (!human.waiting && human.turnActive) {
    const restTime = input.resume ? human.remainingTurnSeconds(input.nowMs) : input.timeoutSeconds;
    if (restTime === null) throw new Error("Paired hunter is missing a turn deadline");
    events.push({ type: "turn-granted", timeoutSeconds: restTime });
  }
  return events;
}

export function friendlyAuthenticateEvents(
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
    },
  ];
  if (human.turnActive) {
    events.push({ type: "turn-granted", timeoutSeconds: input.timeoutSeconds });
  }
  return events;
}
