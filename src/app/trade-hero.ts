import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Hero } from "../modules/character/domain/hero.ts";

export async function requireTradeHero(
  characters: Pick<CharacterService, "getByAccountId">,
  accountId: number,
): Promise<Hero> {
  const hero = await characters.getByAccountId(accountId);
  if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
  return hero;
}
