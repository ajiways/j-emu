import type { ProfessionCatalog } from "../../catalog/ports/profession-catalog.ts";
import {
  PROFESSION_TYPE_CRAFT,
  PROFESSION_TYPE_GATHER,
} from "../../catalog/domain/profession-ids.ts";
import { CharacterNotFoundError } from "../domain/character-not-found-error.ts";
import { GhostHeroError } from "../domain/ghost-hero-error.ts";
import { UnknownProfessionError } from "../domain/unknown-profession-error.ts";
import type { HeroProfessionRepository } from "../ports/hero-profession-repository.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { BumpCraftSkillCommand } from "../ports/character-professions.ts";

export async function bumpHeroCraftSkill(
  heroes: HeroRepository,
  licenses: HeroProfessionRepository,
  catalog: ProfessionCatalog,
  command: BumpCraftSkillCommand,
): Promise<number> {
  if (!Number.isInteger(command.characterId) || command.characterId < 1) {
    throw new Error("Character id is required");
  }
  if (!Number.isInteger(command.professionId) || command.professionId < 1) {
    throw new Error("Profession id is required");
  }
  const hero = await heroes.lockById(command.characterId);
  if (!hero) throw new CharacterNotFoundError(command.characterId);
  if (hero.ghost) throw new GhostHeroError(command.characterId, "bumpCraftSkill");
  const definition = await catalog.profession(command.professionId);
  if (!definition) throw new UnknownProfessionError(command.professionId);
  if (definition.type === PROFESSION_TYPE_GATHER || command.professionId <= 3) {
    throw new Error(`Gathering profession ${command.professionId} cannot bump hero craft skill`);
  }
  if (definition.type !== PROFESSION_TYPE_CRAFT) {
    throw new Error(`Profession ${command.professionId} is not a craft profession`);
  }
  const rows = await licenses.listByHeroId(command.characterId);
  const current = rows.find((row) => row.professionId === command.professionId);
  if (!current) throw new Error(`Profession ${command.professionId} license is missing`);
  const next = current.value + 1;
  await licenses.updateValue(command.characterId, command.professionId, next);
  return next;
}
