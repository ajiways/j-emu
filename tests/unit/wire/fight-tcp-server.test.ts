import net from "node:net";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { FinishedFightRecorder } from "../../../src/modules/combat/application/finished-fight-recorder.ts";
import { encodeAmf3 } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { decodeFrames } from "../../../src/modules/jugger-wire/amf/framing.ts";
import { LongPollCoordinator } from "../../../src/modules/jugger-wire/application/long-poll-coordinator.ts";
import { FightWireMapper } from "../../../src/modules/jugger-wire/application/fight-wire-mapper.ts";
import { FightTcpServer } from "../../../src/modules/jugger-wire/infrastructure/tcp/fight-tcp-server.ts";
import { FproxyCommandRegistry } from "../../../src/modules/jugger-wire/registry/fproxy-command-registry.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";
import { fightEventTypes, huntOppNewFrom } from "../../support/harness/wire-payload.ts";
import { unitHuntStart } from "../../support/hunt-start-input.ts";
import { UNIT_BATTLE_RULES } from "../../support/battle-rules.ts";
import { ManualCombatDelay } from "../../support/fakes/manual-combat-delay.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";
import { MutableClock } from "../../support/fakes/mutable-clock.ts";
import { RecordingFinishedFightStore } from "../../support/fakes/recording-finished-fight-store.ts";
import { RecordingHistoryWriteObserver } from "../../support/fakes/recording-history-write-observer.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

describe("FightTcpServer", () => {
  it("answers the Flash policy request and delivers bootstrap on TCP poll", async () => {
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
    const longPoll = new LongPollCoordinator();
    const server = new FightTcpServer(
      combat,
      FproxyCommandRegistry.fromMeleeSourceIds({ left: 1, center: 2, right: 3 }),
      new FightWireMapper(
        {
          host: "s1.jugger.ru",
          port: 33120,
          proxyPath: "https://s1.jugger.ru/fproxy//;",
        },
        {
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
      ),
      longPoll,
      { info() {}, error() {} },
    );
    await server.listen("127.0.0.1", 0);
    const socket = net.connect({ host: "127.0.0.1", port: server.listeningPort() });
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => chunks.push(chunk));
    try {
      await once(socket, "connect");
      socket.write("<policy-file-request/>\0");
      const policy = await waitForBuffer(chunks, (buf) => buf.includes("cross-domain-policy"));
      expect(policy.toString("utf8")).toContain("allow-access-from");
      socket.write(lengthPrefixed(encodeAmf3({ rc: "auth", eid: started.fightId, sq: 1 })));
      socket.write(lengthPrefixed(Buffer.alloc(0)));
      const frames = decodeFrames(
        (await waitForBuffer(chunks, (buf) => buf.length > policy.length + 4)).subarray(
          policy.length,
        ),
      );
      expect(frames).toEqual(
        expect.arrayContaining([{ rs: true, sq: 1, akey: started.accessKey }]),
      );
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
    } finally {
      socket.destroy();
      longPoll.shutdown();
      await server.close();
    }
  });
});

function lengthPrefixed(payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length);
  return Buffer.concat([header, payload]);
}

async function waitForBuffer(chunks: Buffer[], ready: (buf: Buffer) => boolean): Promise<Buffer> {
  const deadline = Date.now() + 2_000;
  for (;;) {
    const buf = Buffer.concat(chunks);
    if (ready(buf)) return buf;
    if (Date.now() >= deadline) throw new Error("Fight TCP socket produced no matching bytes");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
