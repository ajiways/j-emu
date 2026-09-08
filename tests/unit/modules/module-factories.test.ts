import { describe, expect, it } from "vitest";
import type { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { CombatModule } from "../../../src/modules/combat/combat-module.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import { JuggerWireModule } from "../../../src/modules/jugger-wire/jugger-wire-module.ts";
import { WorldModule } from "../../../src/modules/world/world-module.ts";
import type { AppConfig } from "../../../src/app/config.ts";
import type { PlayableAccountRegistration } from "../../../src/app/playable-account-registration.ts";
import type { PlayableDevelopmentIdentity } from "../../../src/app/playable-development-identity.ts";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../../../src/modules/character/application/character-service.ts";
import type { CombatPort } from "../../../src/modules/combat/ports/combat-port.ts";
import type { IdentityService } from "../../../src/modules/identity/application/identity-service.ts";
import type { InventoryService } from "../../../src/modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../../../src/modules/world/domain/world-service.ts";
import type { Clock } from "../../../src/shared/kernel/clock.ts";
import { PLAYABLE_HERO_CREATION } from "../../support/hero-fixtures.ts";

const database = undefined as unknown as PostgresDatabase;

describe("module factories", () => {
  it("fails fast when required identity dependencies are missing", () => {
    expect(() => IdentityModule.create({ database })).toThrow(
      /Identity module requires a database/,
    );
  });

  it("fails fast when required character dependencies are missing", () => {
    expect(() =>
      CharacterModule.create({
        database,
        creationPolicy: PLAYABLE_HERO_CREATION,
      }),
    ).toThrow(/Character module requires a database/);
    expect(() =>
      CharacterModule.create({
        database: {} as PostgresDatabase,
        creationPolicy: { ...PLAYABLE_HERO_CREATION, hp: 28, maxHp: 27 },
      }),
    ).toThrow(/HP policy/);
  });

  it("fails fast when required inventory dependencies are missing", () => {
    expect(() =>
      InventoryModule.create({
        database,
        starterItems: [{ artifactId: 1, quantity: 1, location: { kind: "bag" } }],
      }),
    ).toThrow(/Inventory module requires a database/);
    expect(() =>
      InventoryModule.create({ database: {} as PostgresDatabase, starterItems: [] }),
    ).toThrow(/Starter inventory policy is required/);
  });

  it("fails fast when required catalog and world dependencies are missing", async () => {
    await expect(CatalogModule.create({ database })).rejects.toThrow(
      /Catalog module requires a database/,
    );
    await expect(WorldModule.create({ database })).rejects.toThrow(
      /World module requires a database/,
    );
  });

  it("fails fast when required combat dependencies are missing", () => {
    expect(() =>
      CombatModule.create({
        database,
        rules: {
          playerDamageMin: 1,
          playerDamageMax: 2,
          botDamageMin: 1,
          botDamageMax: 2,
          turnTimeoutSeconds: 20,
        },
      }),
    ).toThrow(/Combat module requires a database/);
  });

  it("fails fast when required jugger-wire dependencies are missing", async () => {
    await expect(
      JuggerWireModule.create({
        config: undefined as unknown as AppConfig,
        identity: {} as IdentityService,
        registration: {} as PlayableAccountRegistration,
        developmentIdentity: {} as PlayableDevelopmentIdentity,
        characters: {} as CharacterService,
        inventory: {} as InventoryService,
        catalog: {} as Catalog,
        world: {} as WorldService,
        combat: {} as CombatPort,
        clock: {} as Clock,
        bootstrap: undefined as never,
        fightWire: undefined as never,
        meleeSourceIds: undefined as never,
      }),
    ).rejects.toThrow(/Jugger-wire module requires config/);
  });

  it("closes modules that own no process resources", async () => {
    const identity = IdentityModule.create({ database: {} as PostgresDatabase });
    await expect(identity.close()).resolves.toBeUndefined();
    const combat = CombatModule.create({
      database: {} as PostgresDatabase,
      rules: {
        playerDamageMin: 1,
        playerDamageMax: 2,
        botDamageMin: 1,
        botDamageMax: 2,
        turnTimeoutSeconds: 20,
      },
    });
    await expect(combat.close()).resolves.toBeUndefined();
    const characters = CharacterModule.create({
      database: {} as PostgresDatabase,
      creationPolicy: PLAYABLE_HERO_CREATION,
    });
    await expect(characters.close()).resolves.toBeUndefined();
    const inventory = InventoryModule.create({
      database: {} as PostgresDatabase,
      starterItems: [{ artifactId: 1, quantity: 1, location: { kind: "bag" } }],
    });
    await expect(inventory.close()).resolves.toBeUndefined();
  });

  it("rejects a missing Pub1 directory during jugger-wire startup", async () => {
    await expect(
      JuggerWireModule.create({
        config: {
          host: "127.0.0.1",
          port: 18082,
          httpOnly: true,
          databaseUrl: "postgres://unused",
          pub1Dir: "E:/missing-j-emu-pub1",
          certsDir: "E:/missing-j-emu-certs",
          esrvPollMs: 1,
          fproxyPollMs: 1,
          logLevel: "silent",
          gamePolicyFile: "config/development.json",
          fightProxyHost: "s1.jugger.ru",
          fightProxyPath: "/fproxy/",
          fightProxyPort: 33120,
        },
        identity: {} as IdentityService,
        registration: {} as PlayableAccountRegistration,
        developmentIdentity: {} as PlayableDevelopmentIdentity,
        characters: {} as CharacterService,
        inventory: {} as InventoryService,
        catalog: {} as Catalog,
        world: {} as WorldService,
        combat: {} as CombatPort,
        clock: {} as Clock,
        bootstrap: {
          bagCapacity: 1,
          pocketCapacity: 1,
          chat: {
            protocol: "mpd",
            key: "EMUKEY1",
            chat_server: "https://s1.jugger.ru/esrv//emu",
          },
          menuLinks: { "3": "1465239232" },
        },
        fightWire: {
          heroSkill: 1,
          heroBody: "m1",
          autoFight: 0,
          canLeave: 1,
          companionEnabled: 0,
          isPvp: 0,
          instanceId: "0",
          type: "1",
          isSlaughter: false,
          flags: "0",
        },
        meleeSourceIds: { left: 1, center: 2, right: 3 },
      }),
    ).rejects.toThrow(/Pub1 directory does not exist/);
  });
});
