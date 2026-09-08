import type { PostgresDatabase } from "../../src/infrastructure/postgres/database.ts";
import type { CatalogProgression } from "../../src/modules/catalog/ports/catalog-progression.ts";
import type { HeroCreationPolicy } from "../../src/modules/character/domain/hero.ts";
import type { RegenPolicy } from "../../src/modules/character/domain/regen-policy.ts";
import type { ActiveFightQuery } from "../../src/modules/character/ports/active-fight-query.ts";
import type { EquippedModifiers } from "../../src/modules/character/ports/equipped-modifiers.ts";
import type { Clock } from "../../src/shared/kernel/clock.ts";
import { SystemClock } from "../../src/shared/kernel/system-clock.ts";
import {
  IdleActiveFightQuery,
  PLAYABLE_HERO_CREATION,
  PLAYABLE_REGEN_POLICY,
} from "./hero-fixtures.ts";

export function playableCharacterModuleInput(
  database: PostgresDatabase,
  progression: CatalogProgression,
  equipmentModifiers: EquippedModifiers,
  extras: {
    clock?: Clock;
    regenPolicy?: RegenPolicy;
    activeFight?: ActiveFightQuery;
    creationPolicy?: HeroCreationPolicy;
  } = {},
) {
  return {
    database,
    creationPolicy: extras.creationPolicy ?? PLAYABLE_HERO_CREATION,
    progression,
    equipmentModifiers,
    clock: extras.clock ?? new SystemClock(),
    regenPolicy: extras.regenPolicy ?? PLAYABLE_REGEN_POLICY,
    activeFight: extras.activeFight ?? new IdleActiveFightQuery(),
  };
}
