import type { CombatEvent } from "../../combat/ports/combat-port.ts";
import { fightPersEffEvent, fightStandingEffectUseEvent } from "./fight-effect-wire.ts";
import { huntPersSpellsEvent } from "./hunt-fight-pers-spells.ts";
import { huntPersListEvent } from "./hunt-fight-pers-wire.ts";
import { humanOppNewEvent } from "./human-opp-new-event.ts";

type FriendlyBootstrap = Extract<CombatEvent, { type: "friendly-bootstrap" }>;

export function friendlyFightBootstrapEvents(
  event: FriendlyBootstrap,
): readonly Readonly<Record<string, unknown>>[] {
  const { hero, opponent } = event;
  const listed = [hero, ...event.allies, ...(opponent ? [opponent] : [])];
  const events: Readonly<Record<string, unknown>>[] = [
    { bg: 1, et: "fightState", pvp: true, startTime: 0 },
    huntPersListEvent(listed, []),
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
    fightPersEffEvent(hero.id, event.heroEffects),
    ...event.heroEffects.map((fx) => fightStandingEffectUseEvent(fx, hero.id)),
  ];
  if (event.waiting || !opponent) {
    events.push({ et: "oppwait" });
    return events;
  }
  if (!event.opponentAppearance) {
    throw new Error("Friendly duel opponent appearance is required");
  }
  events.push(humanOppNewEvent(opponent, event.opponentAppearance));
  if (event.opponentEffects) {
    events.push(fightPersEffEvent(opponent.id, event.opponentEffects));
    events.push(...event.opponentEffects.map((fx) => fightStandingEffectUseEvent(fx, opponent.id)));
  }
  return events;
}
