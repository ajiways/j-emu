import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PlayableAccountRegistration } from "../../../src/app/playable-account-registration.ts";
import { loadGamePolicy } from "../../../src/app/game-policy.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { publishDevelopmentContent } from "../../../src/infrastructure/postgres/publish-development-content.ts";
import { CatalogModule } from "../../../src/modules/catalog/catalog-module.ts";
import { CharacterModule } from "../../../src/modules/character/character-module.ts";
import { DuplicateAccountError } from "../../../src/modules/identity/domain/duplicate-account-error.ts";
import { IdentityModule } from "../../../src/modules/identity/identity-module.ts";
import { InventoryModule } from "../../../src/modules/inventory/inventory-module.ts";
import type { PresenceFanout } from "../../../src/modules/jugger-wire/application/presence-fanout.ts";
import { uniqueDevelopmentSlot } from "../../support/harness/unique-development-slot.ts";
import { playableCharacterModuleInput } from "../../support/playable-character-module-input.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";
import { SystemClock } from "../../../src/shared/kernel/system-clock.ts";

const databaseUrl = requireTestDatabaseUrl();
const policy = loadGamePolicy(path.resolve(process.cwd(), "config/development.json"));

describe("playable account registration", () => {
  let database: PostgresDatabase;
  let identity: IdentityModule;
  let characters: CharacterModule;
  let inventory: InventoryModule;
  let registration: PlayableAccountRegistration;

  beforeAll(async () => {
    await publishDevelopmentContent(
      databaseUrl,
      path.resolve(process.cwd(), "content/playable-slice.json"),
    );
    database = new PostgresDatabase(databaseUrl);
    identity = IdentityModule.create({ database, clock: new SystemClock() });
    const catalog = await CatalogModule.create({ database });
    inventory = InventoryModule.create({
      database,
      starterItems: policy.starterItems,
      releaseArtifacts: catalog.releaseArtifacts,
      catalog: catalog.catalog,
      bagCapacity: policy.bootstrap.bagCapacity,
      pocketCapacity: policy.bootstrap.pocketCapacity,
    });
    characters = CharacterModule.create(
      playableCharacterModuleInput(database, catalog.progression, inventory.service, {
        creationPolicy: policy.heroCreation,
      }),
    );
    registration = new PlayableAccountRegistration(
      identity.service,
      characters.service,
      inventory.service,
      database,
      silentPresence(),
    );
  });

  afterAll(async () => {
    await identity.close();
    await characters.close();
    await inventory.close();
    await database.close();
  });

  it("stores a password hash and creates the hero with starter inventory", async () => {
    const login = `u${uniqueDevelopmentSlot()}`;
    const nick = `N${uniqueDevelopmentSlot()}`;
    const password = "secret1";
    const authenticated = await registration.register(login, nick, password);
    expect(authenticated.account.passwordHash).not.toBe(password);
    expect(authenticated.account.passwordHash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

    const hero = await characters.service.getByAccountId(authenticated.account.id);
    if (!hero) throw new Error("Registered account has no hero");
    expect(hero).toMatchObject({ level: 1, exp: 1, hp: 10, maxHp: 10, mp: 12, maxMp: 12 });
    const items = await inventory.service.list(hero.id);
    expect(items).toHaveLength(policy.starterItems.length);

    await expect(
      registration.register(login, `N${uniqueDevelopmentSlot()}`, password),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
    await expect(
      registration.register(`u${uniqueDevelopmentSlot()}`, nick, password),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
  });
});

function silentPresence(): PresenceFanout {
  return {
    afterSessionCommitted: async () => {},
    afterLogout: async () => {},
    afterMove: async () => {},
  } as unknown as PresenceFanout;
}
