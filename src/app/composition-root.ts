import { PostgresDatabase } from "../infrastructure/postgres/database.ts";
import { CatalogModule } from "../modules/catalog/catalog-module.ts";
import { CharacterModule } from "../modules/character/character-module.ts";
import { CombatModule } from "../modules/combat/combat-module.ts";
import { IdentityModule } from "../modules/identity/identity-module.ts";
import { InventoryModule } from "../modules/inventory/inventory-module.ts";
import { JuggerWireModule } from "../modules/jugger-wire/jugger-wire-module.ts";
import { WorldModule } from "../modules/world/world-module.ts";
import { PostgresHeroRepository } from "../modules/character/infrastructure/postgres-hero-repository.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import { SystemClock } from "../shared/kernel/system-clock.ts";
import { AccountKeyedActiveFightQuery } from "./account-keyed-active-fight-query.ts";
import { Application } from "./application.ts";
import type { AppConfig } from "./config.ts";
import { loadGamePolicy } from "./game-policy.ts";
import { PlayableAccountRegistration } from "./playable-account-registration.ts";
import { PlayableDevelopmentIdentity } from "./playable-development-identity.ts";

export class CompositionRoot {
  async build(config: AppConfig, clock: Clock = new SystemClock()): Promise<Application> {
    const policy = loadGamePolicy(config.gamePolicyFile);
    const closers: Array<{ close(): Promise<void> }> = [];
    try {
      const database = new PostgresDatabase(config.databaseUrl);
      closers.push(database);
      const identity = IdentityModule.create({ database, clock });
      closers.push(identity);
      const catalog = await CatalogModule.create({ database });
      closers.push(catalog);
      const inventory = InventoryModule.create({
        database,
        starterItems: policy.starterItems,
        releaseArtifacts: catalog.releaseArtifacts,
      });
      closers.push(inventory);
      const world = await WorldModule.create({ database });
      closers.push(world);
      const combat = CombatModule.create({ database, rules: policy.combat, clock });
      combat.startHistoryCleanup();
      closers.push(combat);
      const characters = CharacterModule.create({
        database,
        creationPolicy: policy.heroCreation,
        progression: catalog.progression,
        equipmentModifiers: inventory.service,
        clock,
        regenPolicy: policy.regen,
        activeFight: new AccountKeyedActiveFightQuery(
          new PostgresHeroRepository(database),
          combat.combat,
        ),
      });
      closers.push(characters);
      const registration = new PlayableAccountRegistration(
        identity.service,
        characters.service,
        inventory.service,
        database,
      );
      const developmentIdentity = new PlayableDevelopmentIdentity(
        identity.service,
        characters.service,
        inventory.service,
        database,
      );
      const wire = await JuggerWireModule.create({
        config,
        identity: identity.service,
        registration,
        developmentIdentity,
        characters: characters.service,
        inventory: inventory.service,
        catalog: catalog.catalog,
        world: world.service,
        combat: combat.combat,
        clock,
        bootstrap: policy.bootstrap,
        fightWire: policy.fightWire,
        meleeSourceIds: policy.combat.meleeSourceIds,
        unitOfWork: database,
      });
      closers.push(wire);
      return new Application(wire.http, characters.service, characters.service, async () => {
        await closeAll(closers);
      });
    } catch (error) {
      await closeAll(closers);
      throw error;
    }
  }
}

async function closeAll(closers: readonly { close(): Promise<void> }[]): Promise<void> {
  for (const closer of [...closers].reverse()) {
    await closer.close();
  }
}
