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
import type { StorePurchase } from "../../../src/app/store-purchase.ts";
import type { StoreRepair } from "../../../src/app/store-repair.ts";
import type { MailSend } from "../../../src/app/mail-send.ts";
import type { MailClaim } from "../../../src/app/mail-claim.ts";
import { MailModule } from "../../../src/modules/mail/mail-module.ts";
import type { MailService } from "../../../src/modules/mail/application/mail-service.ts";
import type { PlayableAccountRegistration } from "../../../src/app/playable-account-registration.ts";
import type { PlayableDevelopmentIdentity } from "../../../src/app/playable-development-identity.ts";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";
import type { CatalogProgression } from "../../../src/modules/catalog/ports/catalog-progression.ts";
import type { ReputationCatalog } from "../../../src/modules/catalog/ports/reputation-catalog.ts";
import type { ReleaseArtifacts } from "../../../src/modules/catalog/ports/release-artifacts.ts";
import type { EquippedModifiers } from "../../../src/modules/character/ports/equipped-modifiers.ts";
import type { CharacterService } from "../../../src/modules/character/application/character-service.ts";
import type { CombatDelay } from "../../../src/modules/combat/ports/combat-delay.ts";
import type { CombatPort } from "../../../src/modules/combat/ports/combat-port.ts";
import type { IdentityService } from "../../../src/modules/identity/application/identity-service.ts";
import type { InventoryService } from "../../../src/modules/inventory/domain/inventory-service.ts";
import type { PresenceService } from "../../../src/modules/world/application/presence-service.ts";
import type { WorldService } from "../../../src/modules/world/domain/world-service.ts";
import type { EsrvOutbox } from "../../../src/modules/jugger-wire/application/esrv-outbox.ts";
import { LongPollCoordinator } from "../../../src/modules/jugger-wire/application/long-poll-coordinator.ts";
import type { PresenceFanout } from "../../../src/modules/jugger-wire/application/presence-fanout.ts";
import type { HuntAreaFanout } from "../../../src/modules/jugger-wire/application/hunt-area-fanout.ts";
import type { Clock } from "../../../src/shared/kernel/clock.ts";
import type { UnitOfWork } from "../../../src/shared/kernel/unit-of-work.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";
import {
  IdleActiveFightQuery,
  PLAYABLE_HERO_CREATION,
  PLAYABLE_REGEN_POLICY,
} from "../../support/hero-fixtures.ts";

const database = undefined as unknown as PostgresDatabase;
const progression = {} as CatalogProgression;
const reputationCatalog = {} as ReputationCatalog;
const equipmentModifiers = {} as EquippedModifiers;
const releaseArtifacts = {} as ReleaseArtifacts;
const clock = {} as Clock;
const activeFight = new IdleActiveFightQuery();
const combatRules = UNIT_BATTLE_RULES;
const combatDelay = new ManualCombatDelay();

describe("module factories", () => {
  it("fails fast when required identity dependencies are missing", () => {
    expect(() => IdentityModule.create({ database, clock })).toThrow(
      /Identity module requires a database/,
    );
    expect(() =>
      IdentityModule.create({
        database: {} as PostgresDatabase,
        clock: undefined as unknown as Clock,
      }),
    ).toThrow(/Identity module requires a clock/);
  });

  it("fails fast when required character dependencies are missing", () => {
    expect(() =>
      CharacterModule.create({
        database,
        creationPolicy: PLAYABLE_HERO_CREATION,
        progression,
        reputationCatalog,
        equipmentModifiers,
        clock,
        regenPolicy: PLAYABLE_REGEN_POLICY,
        activeFight,
      }),
    ).toThrow(/Character module requires a database/);
    expect(() =>
      CharacterModule.create({
        database: {} as PostgresDatabase,
        creationPolicy: PLAYABLE_HERO_CREATION,
        progression,
        reputationCatalog,
        equipmentModifiers,
        clock: undefined as unknown as Clock,
        regenPolicy: PLAYABLE_REGEN_POLICY,
        activeFight,
      }),
    ).toThrow(/Character module requires a clock/);
    expect(() =>
      CharacterModule.create({
        database: {} as PostgresDatabase,
        creationPolicy: PLAYABLE_HERO_CREATION,
        progression,
        reputationCatalog,
        equipmentModifiers,
        clock,
        regenPolicy: PLAYABLE_REGEN_POLICY,
        activeFight: undefined as never,
      }),
    ).toThrow(/Character module requires an active-fight query/);
    expect(() =>
      CharacterModule.create({
        database: {} as PostgresDatabase,
        creationPolicy: { ...PLAYABLE_HERO_CREATION, exp: 2 },
        progression,
        reputationCatalog,
        equipmentModifiers,
        clock,
        regenPolicy: PLAYABLE_REGEN_POLICY,
        activeFight,
      }),
    ).toThrow(/EXP must be 1/);
  });

  it("fails fast when required inventory dependencies are missing", () => {
    const random = { unit: () => 0 };
    expect(() =>
      InventoryModule.create({
        database,
        starterItems: [{ artifactId: 1, quantity: 1, location: { kind: "bag" } }],
        releaseArtifacts,
        catalog: {} as Catalog,
        bagCapacity: 20,
        pocketCapacity: 4,
        random,
      }),
    ).toThrow(/Inventory module requires a database/);
    expect(() =>
      InventoryModule.create({
        database: {} as PostgresDatabase,
        starterItems: [],
        releaseArtifacts,
        catalog: {} as Catalog,
        bagCapacity: 20,
        pocketCapacity: 4,
        random,
      }),
    ).toThrow(/Starter inventory policy is required/);
    expect(() =>
      InventoryModule.create({
        database: {} as PostgresDatabase,
        starterItems: [{ artifactId: 1, quantity: 1, location: { kind: "bag" } }],
        releaseArtifacts,
        catalog: undefined as unknown as Catalog,
        bagCapacity: 20,
        pocketCapacity: 4,
        random,
      }),
    ).toThrow(/Inventory module requires a catalog/);
    expect(() =>
      InventoryModule.create({
        database: {} as PostgresDatabase,
        starterItems: [{ artifactId: 1, quantity: 1, location: { kind: "bag" } }],
        releaseArtifacts,
        catalog: {} as Catalog,
        bagCapacity: 20,
        pocketCapacity: undefined as unknown as number,
        random,
      }),
    ).toThrow(/Inventory module requires pocket capacity/);
    expect(() =>
      InventoryModule.create({
        database: {} as PostgresDatabase,
        starterItems: [{ artifactId: 1, quantity: 1, location: { kind: "bag" } }],
        releaseArtifacts,
        catalog: {} as Catalog,
        bagCapacity: 20,
        pocketCapacity: 4,
        random: undefined as unknown as Readonly<{ unit(): number }>,
      }),
    ).toThrow(/Inventory module requires a random source/);
  });

  it("fails fast when required catalog and world dependencies are missing", async () => {
    await expect(CatalogModule.create({ database })).rejects.toThrow(
      /Catalog module requires a database/,
    );
    await expect(
      WorldModule.create({
        database,
        clock,
        delay: combatDelay,
        random: { integer: () => 0, unit: () => 0 },
      }),
    ).rejects.toThrow(/World module requires a database/);
    await expect(
      WorldModule.create({
        database: {} as PostgresDatabase,
        clock: undefined as unknown as Clock,
        delay: combatDelay,
        random: { integer: () => 0, unit: () => 0 },
      }),
    ).rejects.toThrow(/World module requires a clock/);
    await expect(
      WorldModule.create({
        database: {} as PostgresDatabase,
        clock,
        delay: undefined as unknown as CombatDelay,
        random: { integer: () => 0, unit: () => 0 },
      }),
    ).rejects.toThrow(/World module requires a delay scheduler/);
    await expect(
      WorldModule.create({
        database: {} as PostgresDatabase,
        clock,
        delay: combatDelay,
        random: undefined as unknown as { integer(): number; unit(): number },
      }),
    ).rejects.toThrow(/World module requires a random source/);
  });

  it("fails fast when required combat dependencies are missing", () => {
    expect(() =>
      CombatModule.create({
        database,
        rules: combatRules,
        clock,
        delay: combatDelay,
      }),
    ).toThrow(/Combat module requires a database/);
    expect(() =>
      CombatModule.create({
        database: {} as PostgresDatabase,
        rules: combatRules,
        clock: undefined as unknown as Clock,
        delay: combatDelay,
      }),
    ).toThrow(/Combat module requires a clock/);
    expect(() =>
      CombatModule.create({
        database: {} as PostgresDatabase,
        rules: combatRules,
        clock,
        delay: undefined as unknown as CombatDelay,
      }),
    ).toThrow(/Combat module requires a combat delay/);
  });

  it("fails fast when required mail dependencies are missing", () => {
    expect(() =>
      MailModule.create({ database, clock, heroes: { getById: async () => null } }),
    ).toThrow(/Mail module requires a database/);
    expect(() =>
      MailModule.create({
        database: {} as PostgresDatabase,
        clock: undefined as unknown as Clock,
        heroes: { getById: async () => null },
      }),
    ).toThrow(/Mail module requires a clock/);
    expect(() =>
      MailModule.create({
        database: {} as PostgresDatabase,
        clock,
        heroes: undefined as never,
      }),
    ).toThrow(/Mail module requires hero lookup/);
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
        unitOfWork: undefined as never,
        presence: {} as PresenceService,
        presenceFanout: {} as PresenceFanout,
        huntFanout: {} as HuntAreaFanout,
        outbox: {} as EsrvOutbox,
        longPoll: {} as LongPollCoordinator,
        storePurchase: {} as StorePurchase,
        storeRepair: {} as StoreRepair,
        mail: {} as MailService,
        mailSend: {} as MailSend,
        mailClaim: {} as MailClaim,
      }),
    ).rejects.toThrow(/Jugger-wire module requires config/);
  });

  it("closes modules that own no process resources", async () => {
    const identity = IdentityModule.create({ database: {} as PostgresDatabase, clock });
    await expect(identity.close()).resolves.toBeUndefined();
    const combat = CombatModule.create({
      database: {} as PostgresDatabase,
      rules: combatRules,
      clock,
      delay: combatDelay,
    });
    await expect(combat.close()).resolves.toBeUndefined();
    const characters = CharacterModule.create({
      database: {} as PostgresDatabase,
      creationPolicy: PLAYABLE_HERO_CREATION,
      progression,
      reputationCatalog,
      equipmentModifiers,
      clock,
      regenPolicy: PLAYABLE_REGEN_POLICY,
      activeFight,
    });
    await expect(characters.close()).resolves.toBeUndefined();
    const inventory = InventoryModule.create({
      database: {} as PostgresDatabase,
      starterItems: [{ artifactId: 1, quantity: 1, location: { kind: "bag" } }],
      releaseArtifacts,
      catalog: {} as Catalog,
      bagCapacity: 20,
      pocketCapacity: 4,
      random: { unit: () => 0 },
    });
    await expect(inventory.close()).resolves.toBeUndefined();
    const mail = MailModule.create({
      database: {} as PostgresDatabase,
      clock,
      heroes: { getById: async () => null },
    });
    await expect(mail.close()).resolves.toBeUndefined();
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
          fightProxyPath: "https://s1.jugger.ru/fproxy//;",
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
        unitOfWork: {} as UnitOfWork,
        presence: {} as PresenceService,
        presenceFanout: {} as PresenceFanout,
        huntFanout: {} as HuntAreaFanout,
        outbox: {} as EsrvOutbox,
        longPoll: new LongPollCoordinator(),
        storePurchase: {} as StorePurchase,
        storeRepair: {} as StoreRepair,
        mail: {} as MailService,
        mailSend: {} as MailSend,
        mailClaim: {} as MailClaim,
      }),
    ).rejects.toThrow(/Pub1 directory does not exist/);
  });
});
