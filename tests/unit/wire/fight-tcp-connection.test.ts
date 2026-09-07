import { describe, expect, it } from "vitest";
import { CombatService } from "../../../src/modules/combat/application/combat-service.ts";
import { encodeAmf3 } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { decodeFrames } from "../../../src/modules/jugger-wire/amf/framing.ts";
import { FproxyCommandRegistry } from "../../../src/modules/jugger-wire/registry/fproxy-command-registry.ts";
import { FightWireMapper } from "../../../src/modules/jugger-wire/application/fight-wire-mapper.ts";
import { FightTcpConnection } from "../../../src/modules/jugger-wire/infrastructure/tcp/fight-tcp-connection.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { MonotonicFightIdSource } from "../../support/fakes/monotonic-fight-id-source.ts";

describe("FightTcpConnection", () => {
  it("uses the same CombatPort without importing the HTTP adapter", async () => {
    const combat = new CombatService(
      new MonotonicFightIdSource(100, 200),
      new SequenceRandom([8]),
      {
        playerDamageMin: 8,
        playerDamageMax: 12,
        botDamageMin: 2,
        botDamageMax: 4,
        turnTimeoutSeconds: 20,
      },
    );
    const started = await combat.startHunt({
      accountId: "account",
      heroId: "hero",
      heroNick: "Hero",
      heroHp: 27,
      botId: 2,
      botNick: "Грызль",
      botLevel: 1,
      botHp: 20,
      arena: "1_1",
    });
    const commands = FproxyCommandRegistry.fromMeleeSourceIds({ left: 1, center: 2, right: 3 });
    const wire = new FightWireMapper(
      { host: "s1.jugger.ru", port: 33120, proxyPath: "/fproxy/" },
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
    );
    const connection = new FightTcpConnection(combat, commands, wire);
    await expect(
      connection.receive(encodeAmf3({ rc: "auth", eid: started.fightId, sq: 1 })),
    ).resolves.toHaveLength(0);
    expect(decodeFrames(await connection.poll())).toEqual([
      { rs: true, sq: 1, akey: started.accessKey },
      {
        oppnew: {
          id: 2,
          nick: "Грызль",
          hp: 20,
          maxHp: 20,
          level: 1,
          team: 2,
        },
      },
      { attacknow: { timeout: 20 } },
    ]);
  });
});
