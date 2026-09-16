import { describe, expect, it } from "vitest";
import { FightWireMapper } from "../../../src/modules/jugger-wire/application/fight-wire-mapper.ts";

const mapper = new FightWireMapper(
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

const start = {
  fightId: "1",
  accessKey: "k",
  participantId: 7,
  arena: "2_1",
  purpose: "hunt" as const,
  instanceCopyId: null,
  fightFlags: null,
};

describe("fight|conf hero look", () => {
  it("copies live hero body into persSelf_body", () => {
    const body = "armor(1_2#4100);head(0,0,8,152);skin()";
    expect(
      mapper.fightConfiguration(start, { heroSkill: 1, heroBody: body }).conf.persSelf_body,
    ).toBe(body);
    expect(
      mapper.fightConfiguration(start, { heroSkill: 1, heroBody: body }).conf.persSelf_sk,
    ).toBe(1);
  });

  it("fails when heroBody is missing", () => {
    expect(() => mapper.fightConfiguration(start, { heroSkill: 1, heroBody: "" })).toThrowError(
      "Fight conf heroBody is required",
    );
  });
});
