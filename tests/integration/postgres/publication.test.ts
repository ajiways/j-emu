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
    await expect(catalog.bot(2)).resolves.toMatchObject({ id: 2, title: "Грызль" });
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
      const activeBot = await catalog.bot(2);
      expect(activeBot?.id).toBe(2);
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
            fightProxyPath: "/fproxy/",
            fightProxyPort: 33120,
          }),
        ).rejects.toThrow(/published content/);
      } finally {
        fs.rmSync(pub1, { recursive: true });
      }
    });
  });
});

function withHuntBot(id: number, title: string): ContentBundle["bots"][number] {
  const sample = playable.bots[0];
  if (!sample) throw new Error("playable bundle has no bots");
  return { ...sample, id, title };
}
