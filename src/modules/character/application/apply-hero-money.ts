import type { HeroRepository } from "../ports/hero-repository.ts";
import type { CreditMoneyCommand, DebitMoneyCommand } from "../ports/character-money.ts";
import { GhostHeroError } from "../domain/ghost-hero-error.ts";

export async function creditHeroMoney(
  heroes: HeroRepository,
  command: CreditMoneyCommand,
): Promise<void> {
  const hero = await heroes.lockById(command.characterId);
  if (!hero) throw new Error(`Hero ${command.characterId} is missing`);
  hero.creditMoney(command.minorUnits);
  await heroes.save(hero);
}

export async function debitHeroMoney(
  heroes: HeroRepository,
  command: DebitMoneyCommand,
): Promise<void> {
  const hero = await heroes.lockById(command.characterId);
  if (!hero) throw new Error(`Hero ${command.characterId} is missing`);
  if (hero.ghost) throw new GhostHeroError(command.characterId, "debitMoney");
  hero.debitMoney(command.minorUnits);
  await heroes.save(hero);
}
