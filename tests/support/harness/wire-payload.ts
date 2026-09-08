import type { AmfValue } from "../../../src/modules/jugger-wire/amf/amf3.ts";

export function heroIdFrom(payload: Record<string, AmfValue>): number {
  const conf = requireRecord(payload["user|conf"], "user|conf");
  if (typeof conf.id !== "number") throw new Error("user|conf.id must be a number");
  if (!Number.isInteger(conf.id) || conf.id < 1) {
    throw new Error("user|conf.id is outside the wire identity range");
  }
  return conf.id;
}

export function bagItemIdFrom(payload: Record<string, AmfValue>): number {
  const bagItem = firstBagItemFrom(payload);
  if (typeof bagItem.id !== "number") throw new Error("bag item id must be a number");
  return bagItem.id;
}

export function bagItemByArtikulId(
  payload: Record<string, AmfValue>,
  artikulId: number,
): Record<string, AmfValue> {
  const bagBlock = requireRecord(payload["user|bag"], "user|bag");
  const bag = requireRecord(bagBlock["bag"], "user|bag.bag");
  for (const value of Object.values(bag)) {
    const item = requireRecord(value, "user|bag.bag item");
    if (item.artikul_id === artikulId) return item;
  }
  throw new Error(`bag item artikul_id ${artikulId} is missing`);
}

export function firstBagItemFrom(payload: Record<string, AmfValue>): Record<string, AmfValue> {
  const bagBlock = requireRecord(payload["user|bag"], "user|bag");
  const bag = requireRecord(bagBlock["bag"], "user|bag.bag");
  const bagItem = Object.values(bag)[0];
  return requireRecord(bagItem, "user|bag.bag item");
}

export function huntFightIdFrom(payload: Record<string, AmfValue>): string {
  const fightBlock = requireRecord(payload["fight|conf"], "fight|conf");
  const conf = requireRecord(fightBlock["conf"], "fight|conf.conf");
  if (typeof conf["fightId"] !== "string") throw new Error("fightId is missing");
  if (!/^[1-9][0-9]*$/.test(conf["fightId"])) {
    throw new Error("fightId must be a positive decimal string");
  }
  if (typeof conf["userId"] !== "string") throw new Error("userId must be a string");
  if (!/^[1-9][0-9]*$/.test(conf["userId"])) {
    throw new Error("userId must be a positive decimal string");
  }
  if (typeof conf["instance_id"] !== "string" || conf["instance_id"] !== "0") {
    throw new Error("instance_id must be the world zero string");
  }
  return conf["fightId"];
}

export function framesIncludeFightFinish(events: readonly AmfValue[]): boolean {
  return events.some(
    (event) =>
      event !== null &&
      typeof event === "object" &&
      !Array.isArray(event) &&
      "fightFinish" in event,
  );
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is missing`);
  }
  return value;
}
