import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

const LEVEL7_EXP = 3622;
const EMPTY_SLOT = { value: 0 };

describe("profession licenses", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("grants gather 2 and craft 6, then unlocks cap 59 at level 7 after restart", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const conf = requireRecord(init["common|conf"], "common|conf");
    expect(Object.keys(requireRecord(conf.profession_info, "profession_info")).sort()).toEqual([
      "2",
      "6",
    ]);
    expect(requireRecord(init["user|professions"], "empty init")).toEqual({
      status: 100,
      professions: Array.from({ length: 16 }, () => EMPTY_SLOT),
      max_profession_skill: 0,
    });
    const heroConf = requireRecord(init["user|conf"], "user|conf");
    if (typeof heroConf.id !== "number") throw new Error("user|conf.id is missing");

    expect(
      await application.characterProfessions.learnProfession({
        characterId: heroConf.id,
        professionId: 2,
      }),
    ).toEqual({ professionId: 2, value: 1, learned: true });
    expect(
      await application.characterProfessions.learnProfession({
        characterId: heroConf.id,
        professionId: 6,
      }),
    ).toEqual({ professionId: 6, value: 1, learned: true });
    expect(
      await application.characterProfessions.learnProfession({
        characterId: heroConf.id,
        professionId: 2,
      }),
    ).toEqual({ professionId: 2, value: 1, learned: false });

    const licensed = filledPair();
    const afterGrant = await client.objectAction({ object: "user", action: "professions", sq: 2 });
    expect(requireRecord(afterGrant["user|professions"], "licensed L1")).toEqual({
      status: 100,
      professions: licensed,
      max_profession_skill: 0,
    });

    const leveled = await application.characterProgression.grantExperience({
      characterId: heroConf.id,
      operationId: `prf:${heroConf.id}:l7`,
      amount: LEVEL7_EXP,
    });
    if (leveled.levelAfter !== 7) {
      throw new Error(`Expected level 7 after ${LEVEL7_EXP} EXP, got ${leveled.levelAfter}`);
    }
    const atCap = await client.objectAction({ object: "user", action: "professions", sq: 3 });
    expect(requireRecord(atCap["user|professions"], "licensed L7")).toEqual({
      status: 100,
      professions: licensed,
      max_profession_skill: 59,
    });

    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const restored = await again.objectAction({ object: "user", action: "professions", sq: 20 });
    expect(requireRecord(restored["user|professions"], "restart")).toEqual({
      status: 100,
      professions: licensed,
      max_profession_skill: 59,
    });
  });
});

function filledPair(): object[] {
  const slots: object[] = Array.from({ length: 16 }, () => EMPTY_SLOT);
  slots[1] = { id: 2, active: true, value: 1 };
  slots[5] = { id: 6, active: true, value: 1 };
  return slots;
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
