import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { encodeAmf3 } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { decodeFrames } from "../../../src/modules/jugger-wire/amf/framing.ts";
import { FproxyCommandRegistry } from "../../../src/modules/jugger-wire/registry/fproxy-command-registry.ts";
import { FightWireMapper } from "../../../src/modules/jugger-wire/application/fight-wire-mapper.ts";
import { FightTcpConnection } from "../../../src/modules/jugger-wire/infrastructure/tcp/fight-tcp-connection.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";
import { RecordingHistoryWriteObserver } from "../../support/fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { fightEventTypes, huntOppNewFrom } from "../../support/harness/wire-payload.ts";
import { unitHuntStart } from "../../support/hunt-start-input.ts";

describe("FightTcpConnection", () => {
  it("uses the same CombatPort without importing the HTTP adapter", async () => {
    const clock = new MutableClock(new Date("2026-09-07T12:00:00.000Z"));
    const combat = new CombatService(
      new MonotonicFightIdSource(1),
      new SequenceRandom([8]),
      UNIT_BATTLE_RULES,
      clock,
      new FinishedFightRecorder(new RecordingFinishedFightStore(), clock),
      new RecordingHistoryWriteObserver(),
      new ManualCombatDelay(),
    );
    const started = await startHuntWithIssuedId(combat, unitHuntStart());
    const commands = FproxyCommandRegistry.fromMeleeSourceIds({ left: 1, center: 2, right: 3 });
    const wire = new FightWireMapper(
      { host: "s1.jugger.ru", port: 33120, proxyPath: "https://s1.jugger.ru/fproxy//;" },
      {
        autoFight: 0,
        canLeave: 1,
        companionEnabled: 0,
        isPvp: 0,
        instanceId: "0",
        type: "1",
        isSlaughter: false,
        flags: "0",
      },
    );
    const connection = new FightTcpConnection(combat, commands, wire);
    await expect(connection.poll()).resolves.toEqual(Buffer.alloc(0));
    await expect(
      connection.receive(encodeAmf3({ rc: "auth", eid: started.fightId, sq: 1 })),
    ).resolves.toHaveLength(0);
    const frames = decodeFrames(await connection.poll());
    expect(frames[0]).toEqual({ rs: true, sq: 1, akey: started.accessKey });
    expect(fightEventTypes(frames)).toEqual(
      expect.arrayContaining(["fightState", "persList", "oppnew", "attacknow"]),
    );
    expect(huntOppNewFrom(frames)).toMatchObject({
      et: "oppnew",
      nick: "Грызль",
      bot: true,
      sk: "11",
      id: 1_000_000,
      team: 2,
    });
  });
});
