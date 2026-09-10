import type { ProfessionCatalog } from "../../catalog/ports/profession-catalog.ts";
import { CharacterNotFoundError } from "../domain/character-not-found-error.ts";
import { GhostHeroError } from "../domain/ghost-hero-error.ts";
import { UnknownProfessionError } from "../domain/unknown-profession-error.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { HeroProfessionRepository } from "../ports/hero-profession-repository.ts";
import type {
  LearnProfessionCommand,
  LearnProfessionResult,
} from "../ports/character-professions.ts";

export async function grantHeroProfession(
  heroes: HeroRepository,
  licenses: HeroProfessionRepository,
  catalog: ProfessionCatalog,
  command: LearnProfessionCommand,
): Promise<LearnProfessionResult> {
  if (!Number.isInteger(command.characterId) || command.characterId < 1) {
    throw new Error("Character id is required");
  }
  if (!Number.isInteger(command.professionId) || command.professionId < 1) {
    throw new Error("Profession id is required");
  }
  const hero = await heroes.lockById(command.characterId);
  if (!hero) throw new CharacterNotFoundError(command.characterId);
  if (hero.ghost) throw new GhostHeroError(command.characterId, "learnProfession");
  const definition = await catalog.profession(command.professionId);
  if (!definition) throw new UnknownProfessionError(command.professionId);
  const rows = await licenses.listByHeroId(command.characterId);
  const current = rows.find((row) => row.professionId === command.professionId);
  if (current) {
    return { professionId: command.professionId, value: current.value, learned: false };
  }
  await licenses.insertLicense(command.characterId, command.professionId, 1);
  return { professionId: command.professionId, value: 1, learned: true };
}
