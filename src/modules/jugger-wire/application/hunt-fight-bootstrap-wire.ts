import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import { huntPersSpellsEvent } from "./hunt-fight-pers-spells.ts";
import { huntHumanPersFields, huntPersListEvent } from "./hunt-fight-pers-wire.ts";
import { huntOppNewEvent } from "./hunt-opp-new-event.ts";

type HuntBootstrap = Extract<CombatEvent, { type: "hunt-bootstrap" }>;

export function huntFightBootstrapEvents(
  event: HuntBootstrap,
): readonly Readonly<Record<string, unknown>>[] {
  const { hero, bot, allies, waiting } = event;
  const events: Readonly<Record<string, unknown>>[] = [
    { bg: 1, et: "fightState", pvp: false, startTime: 0 },
    huntPersListEvent([hero, ...allies], bot),
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
    huntPersSpellsEvent(event.loadout),
    { et: "persEff", persId: hero.id },
    { et: "oppwait" },
  ];
  if (waiting) return events;
  events.push(huntOppNewEvent(bot));
  events.push({ et: "persEff", persId: bot.id });
  return events;
}

export function huntFightRosterEvents(
  event: Extract<CombatEvent, { type: "roster-updated" }>,
): readonly Readonly<Record<string, unknown>>[] {
  return [
    huntPersListEvent(event.humans, event.bot),
    { ...huntHumanPersFields(event.joined), et: "persChangeInfo" },
  ];
}
