import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import { huntPersSpellsEvent } from "./hunt-fight-pers-spells.ts";
import { huntHumanPersFields } from "./hunt-fight-pers-wire.ts";
import { humanOppNewEvent } from "./human-opp-new-event.ts";

type FriendlyBootstrap = Extract<CombatEvent, { type: "friendly-bootstrap" }>;

export function friendlyFightBootstrapEvents(
  event: FriendlyBootstrap,
): readonly Readonly<Record<string, unknown>>[] {
  const { hero, opponent } = event;
  const persList: Record<string, unknown> = {
    et: "persList",
    [String(hero.id)]: huntHumanPersFields(hero),
    [String(opponent.id)]: huntHumanPersFields(opponent),
  };
  return [
    { bg: 1, et: "fightState", pvp: true, startTime: 0 },
    persList,
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
    humanOppNewEvent(opponent, event.opponentAppearance),
    { et: "persEff", persId: opponent.id },
  ];
}
