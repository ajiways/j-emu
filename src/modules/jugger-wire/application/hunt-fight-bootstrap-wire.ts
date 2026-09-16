import type { HuntBotSnap } from "../../combat/domain/battle-event.ts";
import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import { fightPersEffSnapshotEvents } from "./fight-effect-wire.ts";
import { huntPersSpellsEvent } from "./hunt-fight-pers-spells.ts";
import { huntHumanPersFields, huntPersListEvent } from "./hunt-fight-pers-wire.ts";
import { humanOppNewEvent } from "./human-opp-new-event.ts";
import { huntOppNewEvent } from "./hunt-opp-new-event.ts";

type HuntBootstrap = Extract<CombatEvent, { type: "hunt-bootstrap" }>;

export function huntFightBootstrapEvents(
  event: HuntBootstrap,
): readonly Readonly<Record<string, unknown>>[] {
  const { hero, bot, allies, waiting } = event;
  const events: Readonly<Record<string, unknown>>[] = [
    { bg: 1, et: "fightState", pvp: false, startTime: 0 },
    huntPersListEvent([hero, ...allies], event.rosterBots),
    {
      companions: [],
      cp: event.cp,
      cpHits: [...event.cpHits],
      dead: false,
      et: "persSelf",
      hp: hero.hp,
      juggernaut: false,
      maxHp: hero.maxHp,
      maxMp: hero.maxMp,
      mp: hero.mp,
      rage: event.rage,
      aggro: event.aggro,
      team: hero.team,
    },
    huntPersSpellsEvent(event.loadout, event.aggro),
    ...fightPersEffSnapshotEvents(hero.id, event.heroEffects),
    ...event.otherEffects.flatMap((entry) =>
      fightPersEffSnapshotEvents(entry.persId, entry.effects),
    ),
  ];
  if (!event.resumePaired) events.push({ et: "oppwait" });
  if (waiting) return events;
  if (event.humanOpponent) {
    const appearance = event.humanOpponentAppearance;
    if (!appearance) throw new Error("Hunt human opponent appearance is required");
    events.push(humanOppNewEvent(event.humanOpponent, appearance));
    return events;
  }
  events.push(huntOppNewEvent(bot));
  events.push(...fightPersEffSnapshotEvents(bot.id, []));
  return events;
}

export function huntFightRosterEvents(
  event: Extract<CombatEvent, { type: "roster-updated" }>,
): readonly Readonly<Record<string, unknown>>[] {
  return [
    huntPersListEvent(event.humans, rosterUpdatedBots(event)),
    { ...huntHumanPersFields(event.joined), et: "persChangeInfo" },
  ];
}

function rosterUpdatedBots(
  event: Extract<CombatEvent, { type: "roster-updated" }>,
): readonly HuntBotSnap[] {
  if (event.rosterBots !== undefined) return event.rosterBots;
  if (event.bot !== undefined) return [event.bot];
  throw new Error("roster-updated is missing bots");
}
