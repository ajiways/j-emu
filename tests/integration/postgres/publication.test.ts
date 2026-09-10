import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CompositionRoot } from "../../../src/app/composition-root.ts";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { PostgresCatalog } from "../../../src/modules/catalog/infrastructure/postgres-catalog.ts";
import { ContentValidationError } from "../../../src/modules/content/application/content-validation-error.ts";
import type { ContentBundle } from "../../../src/modules/content/domain/content-document.ts";
import { PostgresActiveContentRevision } from "../../../src/modules/content/infrastructure/postgres-active-content-revision.ts";
import { createPostgresContentPublication } from "../../../src/modules/content/infrastructure/create-postgres-content-publication.ts";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import { releases } from "../../../src/modules/content/infrastructure/schema.ts";
import {
  requireTestDatabaseUrl,
  testDatabaseName,
} from "../../support/postgres/test-database-url.ts";
import { withIsolatedTestDatabase } from "../../support/postgres/isolated-test-database.ts";

const databaseUrl = requireTestDatabaseUrl();
const playablePath = path.resolve(process.cwd(), "content/playable-slice.json");
const playable = loadContentBundleFile(playablePath);

describe("content publication", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
  });

  afterAll(async () => {
    await database.close();
  });

  it("seeds the same digest without creating another release", async () => {
    const publication = createPostgresContentPublication(database);
    const first = await publication.seed(playable, playablePath);
    const second = await publication.seed(playable, playablePath);
    expect(second).toEqual(first);
    const rows = await database.session().select({ id: releases.id }).from(releases);
    expect(rows).toHaveLength(1);
    const catalog = new PostgresCatalog(database, new PostgresActiveContentRevision(database));
    const authored = authoredHuntBot();
    const projected = await catalog.bot(authored.id);
    expect(projected).toMatchObject({
      id: authored.id,
      title: authored.title,
      reward: {
        baseExp: authored.baseExp,
        moneyMin: authored.moneyMin,
        moneyMax: authored.moneyMax,
        lootDropCnt: authored.lootDropCnt,
        lootBonusChance: authored.lootBonusChance,
        lootBonusMin: authored.lootBonusMin,
        lootBonusMax: authored.lootBonusMax,
        lootNothingWeight: authored.lootNothingWeight,
      },
    });
    expect(
      projected?.reward.lootEntries.map((entry) => ({
        artikulId: entry.artikulId,
        dropWeight: entry.dropWeight,
        countMin: entry.countMin,
        countMax: entry.countMax,
      })),
    ).toEqual([...authored.lootEntries]);
    const hissa = await catalog.bot(4);
    expect(hissa?.spellBook.spells.map((card) => card.artikulId)).toEqual([396]);
  });

  it("does not change the active revision when a candidate is invalid", async () => {
    const publication = createPostgresContentPublication(database);
    const active = await publication.seed(playable, playablePath);
    const invalid: ContentBundle = {
      ...playable,
      huntSpawns: playable.huntSpawns.map((spawn) => ({ ...spawn, botId: 999 })),
    };
    await expect(publication.publish(invalid)).rejects.toBeInstanceOf(ContentValidationError);
    const catalog = new PostgresCatalog(database, new PostgresActiveContentRevision(database));
    const huntBot = authoredHuntBot();
    await expect(catalog.bot(huntBot.id)).resolves.toMatchObject({
      id: huntBot.id,
      title: huntBot.title,
    });
    const current = await publication.seed(playable, playablePath);
    expect(current.checksum).toBe(active.checksum);
  });

  it("serializes concurrent publications so one revision is active", async () => {
    const firstClient = new PostgresDatabase(databaseUrl);
    const secondClient = new PostgresDatabase(databaseUrl);
    try {
      const extraBot: ContentBundle = {
        ...playable,
        bots: [...playable.bots, withHuntBot(3, "Другой")],
      };
      const results = await Promise.allSettled([
        createPostgresContentPublication(firstClient).publish(extraBot),
        createPostgresContentPublication(secondClient).publish({
          ...extraBot,
          bots: [...playable.bots, withHuntBot(4, "Четвёртый")],
        }),
      ]);
      const accepted = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(accepted.length + rejected.length).toBe(2);
      expect(accepted.length).toBeGreaterThanOrEqual(1);
      const catalog = new PostgresCatalog(database, new PostgresActiveContentRevision(database));
      const huntBot = authoredHuntBot();
      const activeBot = await catalog.bot(huntBot.id);
      expect(activeBot?.id).toBe(huntBot.id);
    } finally {
      await Promise.all([firstClient.close(), secondClient.close()]);
    }
  });

  it("reads the same published revision after reconnect", async () => {
    await createPostgresContentPublication(database).seed(playable, playablePath);
    const first = await new PostgresCatalog(
      database,
      new PostgresActiveContentRevision(database),
    ).artifact(9095);
    await database.close();
    database = new PostgresDatabase(databaseUrl);
    const second = await new PostgresCatalog(
      database,
      new PostgresActiveContentRevision(database),
    ).artifact(9095);
    expect(second).toEqual(first);
    expect(first?.id).toBe(9095);
  });

  it("publishes store 504 types and lots 23/24", async () => {
    await createPostgresContentPublication(database).seed(playable, playablePath);
    const catalog = new PostgresCatalog(database, new PostgresActiveContentRevision(database));
    const types = await catalog.storeTypes("504");
    expect(types.map((row) => row.typeId)).toEqual([-131]);
    const lots = await catalog.storeLots("504");
    expect(lots.map((lot) => ({ lotId: lot.lotId, artikulId: lot.artikulId }))).toEqual([
      { lotId: 82, artikulId: 24 },
      { lotId: 80, artikulId: 23 },
    ]);
    expect(await catalog.storeLots("503")).toEqual([]);
    const arsenal = await catalog.storeLots("552");
    expect(arsenal).toEqual([
      expect.objectContaining({
        lotId: 438,
        artikulId: 621,
        typeId: 11,
        price: 300,
        pay: { currency: "gold", amount: 300 },
        requires: { all: [{ type: "RANK", min: 4 }] },
      }),
    ]);
    expect(await catalog.artifact(621)).toMatchObject({
      id: 621,
      title: "Амулет громилы",
      slotMask: 512,
    });
    expect(await catalog.artifact(23)).toMatchObject({
      id: 23,
      title: "Простая магическая перчатка",
      slotMask: 32,
    });
    expect(await catalog.artifact(24)).toMatchObject({
      id: 24,
      title: "Простой наруч",
      slotMask: 16,
    });
    expect(await catalog.reputationTracks()).toEqual([
      {
        objectId: 5,
        type: 2,
        title: "Репутация Радвея",
        image: "rep_radvey_sm.png",
        unlockFlag: "",
      },
    ]);
  });

  it("rejects a candidate lot whose artifact is missing", async () => {
    const publication = createPostgresContentPublication(database);
    await publication.seed(playable, playablePath);
    const invalid: ContentBundle = {
      ...playable,
      storeLots: [
        ...playable.storeLots,
        {
          areaId: "504",
          lotId: 99,
          artikulId: 8,
          typeId: -131,
          price: 1,
          ord: 99,
          pay: { currency: "gold", amount: 1 },
        },
      ],
    };
    await expect(publication.publish(invalid)).rejects.toBeInstanceOf(ContentValidationError);
    const catalog = new PostgresCatalog(database, new PostgresActiveContentRevision(database));
    const lots = await catalog.storeLots("504");
    expect(lots.some((lot) => lot.lotId === 99)).toBe(false);
  });

  it("activates an additive artifact release and rejects changed progression or artifact skills", async () => {
    const publication = createPostgresContentPublication(database);
    await publication.seed(playable, playablePath);
    const changedCurve: ContentBundle = {
      ...playable,
      levels: playable.levels.map((level) =>
        level.level === 2
          ? {
              ...level,
              managedSkills: level.managedSkills.map((skill) =>
                skill.id === "STR" ? { ...skill, value: skill.value + 1 } : skill,
              ),
            }
          : level,
      ),
    };
    await expect(publication.publish(changedCurve)).rejects.toBeInstanceOf(ContentValidationError);
    const removedGlove: ContentBundle = {
      ...playable,
      artifacts: [],
    };
    await expect(publication.publish(removedGlove)).rejects.toBeInstanceOf(ContentValidationError);
    const changedSkills: ContentBundle = {
      ...playable,
      artifacts: playable.artifacts.map((artifact) => ({
        ...artifact,
        skills: artifact.skills.map((skill) =>
          skill.id === "VIT" ? { ...skill, value: skill.value + 1 } : skill,
        ),
      })),
    };
    await expect(publication.publish(changedSkills)).rejects.toBeInstanceOf(ContentValidationError);
    const extraArtifact: ContentBundle = {
      ...playable,
      artifacts: [...playable.artifacts, { ...playable.artifacts[0]!, id: 9096, title: "Другая" }],
    };
    await expect(publication.publish(extraArtifact)).resolves.toMatchObject({
      checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it("refuses to start without a published revision", async () => {
    const sourceName = testDatabaseName(databaseUrl).replace(/_test$/, "");
    await withIsolatedTestDatabase(`${sourceName}_nopublish_test`, async (isolatedUrl) => {
      await migrateDatabase(isolatedUrl);
      const pub1 = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-nopublish-"));
      try {
        await expect(
          new CompositionRoot().build({
            host: "127.0.0.1",
            port: 18081,
            httpOnly: true,
            databaseUrl: isolatedUrl,
            pub1Dir: pub1,
            certsDir: path.join(pub1, "certs-not-used"),
            esrvPollMs: 1,
            fproxyPollMs: 1,
            logLevel: "silent",
            gamePolicyFile: path.resolve(process.cwd(), "config/development.json"),
            fightProxyHost: "s1.jugger.ru",
            fightProxyPath: "https://s1.jugger.ru/fproxy//;",
            fightProxyPort: 33120,
          }),
        ).rejects.toThrow(/published content/);
      } finally {
        fs.rmSync(pub1, { recursive: true });
      }
    });
  });
});

function authoredHuntBot(): ContentBundle["bots"][number] {
  const spawn = playable.huntSpawns[0];
  if (!spawn) throw new Error("playable bundle has no hunt spawns");
  const bot = playable.bots.find((entry) => entry.id === spawn.botId);
  if (!bot) throw new Error(`playable bundle is missing bot ${spawn.botId}`);
  return bot;
}

function withHuntBot(id: number, title: string): ContentBundle["bots"][number] {
  const sample = playable.bots[0];
  if (!sample) throw new Error("playable bundle has no bots");
  return { ...sample, id, title };
}
