import { describe, expect, it } from "vitest";
import { ProgressNotifier } from "../../../src/app/progress-notifier.ts";
import type { LevelNotice } from "../../../src/modules/catalog/domain/level-notice.ts";
import type { CommonConfBlock } from "../../../src/modules/content/domain/bootstrap-content.ts";
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

const conf = {
  macros_list: { [`${"a".repeat(32)}`]: { key_id: "a".repeat(32), macro_type: "MAP" } },
  rank_info: [
    { id: 0, title: "Простолюдин" },
    { id: 1, title: "Задира" },
    { id: 2, title: "Крепыш" },
  ],
  rank_table: [
    { rank: "0", honor: "0", description: "" },
    { rank: "1", honor: "100", description: `Доступно на [[MAP ${"a".repeat(32)}]]` },
    { rank: "2", honor: "500", description: "" },
  ],
} as unknown as CommonConfBlock;

function setup(notices: ReadonlyMap<number, LevelNotice | null>) {
  const woken: number[] = [];
  const outbox = new EsrvOutbox();
  const catalog = {
    levelNotice: async (level: number) => {
      const row = notices.get(level);
      if (row === undefined) throw new Error(`Level catalog entry ${level} is missing`);
      return row;
    },
    commonConf: async () => conf,
    artifact: async (id: number) => testArtifact({ id, title: `Вещь ${id}`, skills: [] }),
  } as unknown as Catalog;
  const notifier = new ProgressNotifier(catalog, outbox, { wake: (id) => woken.push(id) });
  return { notifier, outbox, woken };
}

describe("ProgressNotifier", () => {
  it("queues one standalone common|window per reached level with an authored notice", async () => {
    const { notifier, outbox, woken } = setup(
      new Map([
        [2, notice(2, [24, 23])],
        [3, null],
        [4, notice(4, [22])],
      ]),
    );
    await notifier.notifyLevel(7, 1, 4);
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
    await notifier.notifyLevel(7, 6, 7);
    expect(outbox.take(7)).toEqual([]);
    expect(woken).toEqual([]);
  });

  it("fails when a reached level is missing from the catalog", async () => {
    const { notifier } = setup(new Map());
    await expect(notifier.notifyLevel(7, 1, 2)).rejects.toThrow("Level catalog entry 2 is missing");
  });

  it("rejects an inverted level range", async () => {
    const { notifier } = setup(new Map());
    await expect(notifier.notifyLevel(7, 3, 2)).rejects.toThrow("Level change 3 -> 2 is invalid");
  });

  it("queues a rank window built from the rank table, for the reached rank", async () => {
    const { notifier, outbox, woken } = setup(new Map());
    await notifier.notifyRank(7, 0, 1, 1);
    const entries = outbox.take(7);
    expect(entries).toHaveLength(1);
    expect(woken).toEqual([7]);
    const first = entries[0]?.fragment as { "common|window": Record<string, unknown> };
    expect(first["common|window"]).toMatchObject({ status: 100, title: "", width: 380 });
    expect(String(first["common|window"]["text"])).toContain("Вы получили звание «Задира»!");
    expect(String(first["common|window"]["text"])).toContain("нужно 500 героизма");
    expect(Object.keys(first["common|window"]["macroses"] as object)).toContain("a".repeat(32));
  });

  it("does nothing for an unchanged rank and rejects an inverted rank range", async () => {
    const { notifier, outbox, woken } = setup(new Map());
    await notifier.notifyRank(7, 1, 1, 1);
    expect(outbox.take(7)).toEqual([]);
    expect(woken).toEqual([]);
    await expect(notifier.notifyRank(7, 2, 1, 1)).rejects.toThrow("Rank change 2 -> 1 is invalid");
  });
});
