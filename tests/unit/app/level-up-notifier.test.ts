import { describe, expect, it } from "vitest";
import { LevelUpNotifier } from "../../../src/app/level-up-notifier.ts";
import type { LevelNotice } from "../../../src/modules/catalog/domain/level-notice.ts";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";
import { EsrvOutbox } from "../../../src/modules/jugger-wire/application/esrv-outbox.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

const notice = (level: number, artikulIds: readonly number[]): LevelNotice => ({
  level,
  headline: `Вы достигли уровня ${level}!`,
  body: "В деревенской лавке вам стало доступно:",
  achievementImage: `/images/data/achievements/achiv_lvl_${level}.png`,
  artikulIds,
});

function setup(notices: ReadonlyMap<number, LevelNotice | null>) {
  const woken: number[] = [];
  const outbox = new EsrvOutbox();
  const catalog = {
    levelNotice: async (level: number) => {
      const row = notices.get(level);
      if (row === undefined) throw new Error(`Level catalog entry ${level} is missing`);
      return row;
    },
    artifact: async (id: number) => testArtifact({ id, title: `Вещь ${id}`, skills: [] }),
  } as unknown as Catalog;
  const notifier = new LevelUpNotifier(catalog, outbox, { wake: (id) => woken.push(id) });
  return { notifier, outbox, woken };
}

describe("LevelUpNotifier", () => {
  it("queues one standalone common|window per reached level with an authored notice", async () => {
    const { notifier, outbox, woken } = setup(
      new Map([
        [2, notice(2, [24, 23])],
        [3, null],
        [4, notice(4, [22])],
      ]),
    );
    await notifier.notify(7, 1, 4);
    const entries = outbox.take(7);
    expect(entries).toHaveLength(2);
    expect(woken).toEqual([7]);
    const first = entries[0]?.fragment as { "common|window": Record<string, unknown> };
    expect(first["common|window"]).toMatchObject({
      status: 100,
      title: "",
      image: "",
      width: 380,
      buttons: [{ caption: "Закрыть" }],
    });
    expect(String(first["common|window"]["text"])).toContain("Вы достигли уровня 2!");
    const macros = Object.values(first["common|window"]["macroses"] as Record<string, object>);
    expect(macros.filter((m) => "macro_type" in m && m.macro_type === "ARTIFACT_IMG")).toHaveLength(
      2,
    );
  });

  it("sends nothing and does not wake when no reached level has a notice", async () => {
    const { notifier, outbox, woken } = setup(new Map([[7, null]]));
    await notifier.notify(7, 6, 7);
    expect(outbox.take(7)).toEqual([]);
    expect(woken).toEqual([]);
  });

  it("fails when a reached level is missing from the catalog", async () => {
    const { notifier } = setup(new Map());
    await expect(notifier.notify(7, 1, 2)).rejects.toThrow("Level catalog entry 2 is missing");
  });

  it("rejects an inverted level range", async () => {
    const { notifier } = setup(new Map());
    await expect(notifier.notify(7, 3, 2)).rejects.toThrow("Level change 3 -> 2 is invalid");
  });
});
