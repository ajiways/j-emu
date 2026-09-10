import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { HuntMapAttack } from "../../../src/modules/jugger-wire/application/hunt-map-attack.ts";
import { Area } from "../../../src/modules/world/domain/area.ts";
import type { WorldService } from "../../../src/modules/world/domain/world-service.ts";
import { unitHuntStart } from "../../support/hunt-start-input.ts";
import { parkedHuntSpawn } from "../../support/parked-hunt-spawn.ts";
import { worldServiceFor } from "../../support/world-service-for.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";
import { RecordingHistoryWriteObserver } from "../../support/fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";

const plaza = new Area(
  "503",
  "Горное поселение",
  "forestvillage.swf",
  "2_1",
  "radvei_map.swf",
  0,
  "",
  "",
  "4",
  "Ambience_village.mp3",
  "Ambience_village.mp3",
  0,
  0,
  0,
  0,
  1,
  0,
  "",
  [parkedHuntSpawn(50310, 2, 883, 1499, "bot_1", 10)],
);

describe("HuntMapAttack", () => {
  it("recycles a stale overlay without a RAM battle into a new startHunt", async () => {
    const { world, combat, attack } = harness();
    expect(
      await world.tryAcquireSpawn({
        areaId: "503",
        spawnId: 50310,
        fightId: "99",
        ownerAccountId: 1,
      }),
    ).toEqual({ ok: true });
    expect(await combat.hasFight("99")).toBe(false);
    const started = await attack.execute({ ...unitHuntStart(), spawnId: 50310 });
    expect(started.fightId).not.toBe("99");
    expect(await combat.hasFight(started.fightId)).toBe(true);
    expect((await world.huntSnapshot("503"))[0]?.fightId).toBe(Number(started.fightId));
  });

  it("joins a live occupied spawn instead of allocating a second fight", async () => {
    const { attack } = harness();
    const started = await attack.execute({ ...unitHuntStart(), spawnId: 50310 });
    const joined = await attack.execute({
      ...unitHuntStart({ accountId: 2, heroId: 2, heroNick: "Joiner" }),
      spawnId: 50310,
    });
    expect(joined.fightId).toBe(started.fightId);
    expect(joined.accessKey).toBe(started.accessKey);
    expect(joined.participantId).toBe(2);
  });

  it("returns 203 already in fight when the opener attacks the same spawn again", async () => {
    const { attack } = harness();
    await attack.execute({ ...unitHuntStart(), spawnId: 50310 });
    await expect(attack.execute({ ...unitHuntStart(), spawnId: 50310 })).rejects.toMatchObject({
      name: "ProtocolError",
      status: 203,
      message: "уже в бою",
    });
  });
});

function harness(): {
  world: WorldService;
  combat: CombatService;
  attack: HuntMapAttack;
} {
  const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
  const world = worldServiceFor(plaza, { clock, delay: new ManualCombatDelay() });
  const combat = new CombatService(
    new MonotonicFightIdSource(1),
    new SequenceRandom([20]),
    UNIT_BATTLE_RULES,
    clock,
    new FinishedFightRecorder(new RecordingFinishedFightStore(), clock),
    new RecordingHistoryWriteObserver(),
    new ManualCombatDelay(),
  );
  const fanout = { wakeArea: async () => undefined };
  return {
    world,
    combat,
    attack: new HuntMapAttack(world, combat, fanout),
  };
}
