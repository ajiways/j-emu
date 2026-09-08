import { CharacterNotFoundError } from "../modules/character/domain/character-not-found-error.ts";
import type { ActiveFightQuery } from "../modules/character/ports/active-fight-query.ts";
import type { HeroRepository } from "../modules/character/ports/hero-repository.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";

export class AccountKeyedActiveFightQuery implements ActiveFightQuery {
  constructor(
    private readonly heroes: HeroRepository,
    private readonly combat: CombatPort,
  ) {}

  async isHeroInActiveFight(characterId: number): Promise<boolean> {
    const hero = await this.heroes.findById(characterId);
    if (!hero) throw new CharacterNotFoundError(characterId);
    return (await this.combat.activeFightId(hero.accountId)) !== null;
  }
}
