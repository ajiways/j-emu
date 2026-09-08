import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";

const INIT_KEYS = [
  "common|init",
  "common|conf",
  "state",
  "user|bag",
  "user|pocket",
  "user|magic",
  "user|conf",
  "user|personal_details",
  "user|skills",
  "user|professions",
  "pet|list",
  "user|mount_list",
  "book|quest_list",
  "book|quest_targets",
  "book|quest_counters",
  "user|campaigns",
] as const;

const INIT2_KEYS = [
  "common|init2",
  "state",
  "user|unitframe",
  "chat|conf",
  "chat|area_population",
  "chat|message",
  "friend|info",
  "user|action_stats",
  "arena|great_fights",
  "user|skills",
  "user|time_to_next_achievement",
  "assistant|farm_info",
  "common|area_conf",
  "common|hunt",
  "bank|info",
  "user|smiles",
  "common|antimat",
  "common|event_conf",
  "common|menu_link_status",
  "common|front_status",
  "common|area_capture_info",
  "common|occurrences_conf",
  "common|farm_agregate",
] as const;

describe("character bootstrap", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("returns the full flat init and init2 inventory", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    for (const key of INIT_KEYS) {
      expect(init[key], key).toBeTypeOf("object");
    }
    expect(init["common|init"]).toEqual({ status: 100 });
    expect(init.state).toMatchObject({
      area_id: "503",
      money: "25.00",
      money_gold: "0.00",
      party: 0,
      clan: 0,
      instance: 0,
    });
    expect(typeof (init.state as { server_time: number }).server_time).toBe("number");
    const conf = objectBlock(init["user|conf"]);
    expect(conf).toMatchObject({ status: 100, level: 1, kind: 1, gender: 1, language: "ru" });
    expect(typeof conf.id).toBe("number");
    const details = objectBlock(init["user|personal_details"]);
    expect(details.info).toMatchObject({
      finished_first_fight: "1",
      tutorial2: '{"finished":true}',
    });
    const skills = objectBlock(init["user|skills"]);
    expect(skills.status).toBe(100);
    const skillIds = skillIdsFrom(skills);
    expect(skillIds).toEqual(expect.arrayContaining(["STR", "VIT", "MPMAX", "HPREG", "ORATORY"]));
    expect(skillIds).not.toContain("MONEYMOD");
    const vit = skillFrom(skills, "VIT");
    expect(vit.value).toBe(10);
    const hpReg = skillFrom(skills, "HPREG");
    expect(hpReg.value).toBe("700");

    const skillsOa = await client.objectAction({ object: "user", action: "skills", sq: 2 });
    expect(objectBlock(skillsOa["user|skills"]).status).toBe(100);

    const init2 = await client.objectAction({ object: "common", action: "init2", sq: 3 });
    for (const key of INIT2_KEYS) {
      expect(init2[key], key).toBeTypeOf("object");
    }
    expect(init2["user|skills"]).toEqual({ expire: 0 });
    const unitframe = objectBlock(init2["user|unitframe"]);
    expect(unitframe).toMatchObject({
      status: 100,
      hp: 10,
      hpMax: 10,
      mp: 12,
      mpMax: 12,
      exp: 1,
      expMin: 0,
      expMax: 68,
      avatar_small: "avatar_m_set_0_gray_sm.png",
    });
    const welcome = objectBlock(init2["chat|message"]);
    const message = objectBlock(welcome.message);
    expect(String(message.msg)).toContain(String(conf.nick));
  });

  it("keeps character HUD state after reconnect and process restart", async () => {
    const client = await AuthenticatedClient.login(application);
    const init = await client.objectAction({ object: "common", action: "init", sq: 1 });
    const heroId = objectBlock(init["user|conf"]).id;
    const vit = skillFrom(objectBlock(init["user|skills"]), "VIT").value;
    application = await harness.restart();
    const again = new AuthenticatedClient(application, client.cookie);
    const after = await again.objectAction({ object: "common", action: "init", sq: 20 });
    expect(objectBlock(after["user|conf"]).id).toBe(heroId);
    expect(skillFrom(objectBlock(after["user|skills"]), "VIT").value).toBe(vit);
    const init2 = await again.objectAction({ object: "common", action: "init2", sq: 21 });
    expect(objectBlock(init2["user|unitframe"])).toMatchObject({ hp: 10, mp: 12, exp: 1 });
  });
});

function objectBlock(value: AmfValue | undefined): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected object block");
  }
  return value;
}

function skillIdsFrom(block: Record<string, AmfValue>): string[] {
  const skills = block.skills;
  if (!Array.isArray(skills)) throw new Error("user|skills.skills is missing");
  return skills.map((row) => {
    const item = objectBlock(row);
    if (typeof item.id !== "string") throw new Error("skill id is missing");
    return item.id;
  });
}

function skillFrom(block: Record<string, AmfValue>, id: string): Record<string, AmfValue> {
  const skills = block.skills;
  if (!Array.isArray(skills)) throw new Error("user|skills.skills is missing");
  for (const row of skills) {
    const item = objectBlock(row);
    if (item.id === id) return item;
  }
  throw new Error(`skill ${id} is missing`);
}
