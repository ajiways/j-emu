import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import { bestiaryInfoWire } from "../modules/character/domain/bestiary-wire.ts";
import type { HeroBestiary } from "../modules/character/ports/hero-bestiary.ts";
import type { InstanceService } from "../modules/instance/application/instance-service.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";

export type BookDeskDeps = Readonly<{
  characters: CharacterService;
  bestiary: HeroBestiary;
  instances: InstanceService;
}>;

export class BookDesk {
  constructor(private readonly deps: BookDeskDeps) {}

  async execute(key: string, accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    if (key === "book|bestiary_info") {
      return nested(bestiaryInfoWire(await this.deps.bestiary.listWins(hero.id)));
    }
    if (key === "book|instances") {
      return nested(await this.deps.instances.bookInstances(hero.id));
    }
    throw new Error(`Book OA ${key} is not registered`);
  }

  private async requireHero(accountId: number): Promise<Hero> {
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}

function nested(value: object): OaEncodedResponse {
  return { kind: "nested", value };
}
