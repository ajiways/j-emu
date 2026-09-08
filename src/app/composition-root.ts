import { PostgresDatabase } from "../infrastructure/postgres/database.ts";
import { CatalogModule } from "../modules/catalog/catalog-module.ts";
import { CharacterModule } from "../modules/character/character-module.ts";
import { CombatModule } from "../modules/combat/combat-module.ts";
import { IdentityModule } from "../modules/identity/identity-module.ts";
import { InventoryModule } from "../modules/inventory/inventory-module.ts";
import { JuggerWireModule } from "../modules/jugger-wire/jugger-wire-module.ts";
import { WorldModule } from "../modules/world/world-module.ts";
import { SystemClock } from "../shared/kernel/system-clock.ts";
import { Application } from "./application.ts";
import type { AppConfig } from "./config.ts";
import { loadGamePolicy } from "./game-policy.ts";
import { PlayableAccountRegistration } from "./playable-account-registration.ts";
import { PlayableDevelopmentIdentity } from "./playable-development-identity.ts";

export class CompositionRoot {
  async build(config: AppConfig): Promise<Application> {
    const policy = loadGamePolicy(config.gamePolicyFile);
    const closers: Array<{ close(): Promise<void> }> = [];
    try {
      const database = new PostgresDatabase(config.databaseUrl);
      closers.push(database);
      const identity = IdentityModule.create({ database });
      closers.push(identity);
      const characters = CharacterModule.create({
        database,
        creationPolicy: policy.heroCreation,
      });
      closers.push(characters);
      const inventory = InventoryModule.create({
        database,
        starterItems: policy.starterItems,
      });
      closers.push(inventory);
      const catalog = await CatalogModule.create({ database });
      closers.push(catalog);
      const world = await WorldModule.create({ database });
      closers.push(world);
      const combat = CombatModule.create({ database, rules: policy.combat });
      combat.startHistoryCleanup();
      closers.push(combat);
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
        clock: new SystemClock(),
        bootstrap: policy.bootstrap,
        fightWire: policy.fightWire,
        meleeSourceIds: policy.combat.meleeSourceIds,
      });
      closers.push(wire);
      return new Application(wire.http, async () => {
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
