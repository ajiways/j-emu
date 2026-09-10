import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import type { AmfValue } from "../../src/modules/jugger-wire/amf/amf3.ts";
import { AuthenticatedClient } from "../support/harness/authenticated-client.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";
import { completeMeleeHunt } from "../support/harness/complete-melee-hunt.ts";
import { SequenceRandom } from "../support/fakes/sequence-random.ts";
import { personalEsrvObject } from "../support/harness/wire-payload.ts";

describe("chat add and fight system lines", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness(undefined, undefined, {
      lootRandom: new SequenceRandom([0, 0, 0, 0, 0, 0, 0, 0]),
    });
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("fans main chat to the same area and keeps private/errors dump-shaped", async () => {
    const [a, b, nickB] = await dualHeroes(application);
    const empty = await a.objectAction({
      object: "chat",
      action: "add",
      form: { message: "   " },
      sq: 2,
    });
    expect(empty["chat|add"]).toEqual({ status: 203, error: "empty message" });

    const missing = await a.objectAction({
      object: "chat",
      action: "add",
      form: { message: "hi", type: "private", recipient_list: ["NoSuchNick"] },
      sq: 3,
    });
    expect(missing["chat|add"]).toEqual({ status: 2, error: "Пользователь не найден!" });

    const sent = await a.objectAction({
      object: "chat",
      action: "add",
      form: { message: "hello area", type: "main" },
      sq: 4,
    });
    expect(sent["chat|add"]).toEqual({ status: 100 });
    const echo = requireRecord(sent["chat|message"], "chat|message");
    expect(echo.status).toBe(100);
    const echoMsg = requireRecord(echo.message, "echo message");
    expect(echoMsg.type).toBe("main");
    expect(echoMsg.msg).toBe("hello area");
    expect(echoMsg.is_self).toBe(true);
    expect(typeof echoMsg.from).toBe("string");

    const remote = chatMessages(await b.pollEsrv());
    expect(remote).toHaveLength(1);
    expect(remote[0]?.msg).toBe("hello area");
    expect(remote[0]?.is_self).toBeUndefined();
    expect(remote[0]?.from).toBe(echoMsg.from);

    const priv = await a.objectAction({
      object: "chat",
      action: "add",
      form: { message: "secret", type: "private", recipient_list: [nickB] },
      sq: 5,
    });
    expect(priv["chat|add"]).toEqual({ status: 100 });
    const privRemote = chatMessages(await b.pollEsrv());
    expect(privRemote[0]?.type).toBe("private");
    expect(privRemote[0]?.msg).toBe("secret");
  });

  it("pushes hunt start/end system chat after settlement without dropping loot", async () => {
    const client = await AuthenticatedClient.login(application);
    await client.objectAction({ object: "common", action: "init", sq: 1 });
    await completeMeleeHunt(client, (ms) => harness.elapseCombat(ms));
    const packets = await client.pollEsrv();
    const chats = chatMessages(packets);
    const texts = chats.map((row) => String(row.msg));
    expect(texts.some((msg) => msg.startsWith("Начался бой "))).toBe(true);
    expect(texts.some((msg) => msg.startsWith("Окончен бой "))).toBe(true);
    expect(texts.some((msg) => msg.startsWith("Вы получили: "))).toBe(true);
    const loot = personalEsrvObject(packets);
    expect(loot["fight|loot"]).toMatchObject({ status: 100, money: "0.2" });
    expect(loot["fight|exit"]).toMatchObject({ status: 100 });
  });
});

async function dualHeroes(
  application: Application,
): Promise<readonly [AuthenticatedClient, AuthenticatedClient, string]> {
  const slotA = uniqueDevelopmentSlot();
  let slotB = uniqueDevelopmentSlot();
  while (slotB === slotA) slotB = uniqueDevelopmentSlot();
  const [clientA, clientB] = await Promise.all([
    AuthenticatedClient.login(application, slotA),
    AuthenticatedClient.login(application, slotB),
  ]);
  const [, initB] = await Promise.all([
    clientA.objectAction({ object: "common", action: "init", sq: 1 }),
    clientB.objectAction({ object: "common", action: "init", sq: 1 }),
  ]);
  const conf = requireRecord(initB["user|conf"], "user|conf");
  if (typeof conf.nick !== "string" || !conf.nick) throw new Error("user|conf.nick missing");
  return [clientA, clientB, conf.nick];
}

function chatMessages(packets: readonly AmfValue[]): Array<Record<string, AmfValue>> {
  const rows: Array<Record<string, AmfValue>> = [];
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) continue;
    if (typeof packet.channel !== "string" || !packet.channel.startsWith("2:")) continue;
    if (!packet.object || typeof packet.object !== "object" || Array.isArray(packet.object)) {
      continue;
    }
    const object = packet.object as Record<string, AmfValue>;
    const block = object["chat|message"];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const message = (block as Record<string, AmfValue>).message;
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new Error("chat|message.message is missing");
    }
    rows.push(message as Record<string, AmfValue>);
  }
  return rows;
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}
