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
  return huntFightConfFrom(payload).fightId;
}

export function huntFightConfFrom(payload: Record<string, AmfValue>): {
  fightId: string;
  fightAkey: string;
  userId: string;
} {
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
  if (typeof conf["fightAkey"] !== "string" || conf["fightAkey"].length < 1) {
    throw new Error("fightAkey is missing");
  }
  if (typeof conf["instance_id"] !== "string" || conf["instance_id"] !== "0") {
    throw new Error("instance_id must be the world zero string");
  }
  return {
    fightId: conf["fightId"],
    fightAkey: conf["fightAkey"],
    userId: conf["userId"],
  };
}

export function framesIncludeFightFinish(events: readonly AmfValue[]): boolean {
  return fightEventTypes(events).includes("fightFinish");
}

export function fightEventTypes(events: readonly AmfValue[]): string[] {
  const types: string[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    const keys = Object.keys(ev).sort((a, b) => Number(a) - Number(b));
    for (const key of keys) {
      const item = ev[key];
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (typeof item["et"] === "string") types.push(item["et"]);
    }
  }
  return types;
}

export function huntOppNewFrom(events: readonly AmfValue[]): Record<string, AmfValue> {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const item of Object.values(ev)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (item["et"] === "oppnew") return item;
    }
  }
  throw new Error("oppnew is missing from fight frames");
}

export function fightPersListIds(events: readonly AmfValue[]): number[] {
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const ev = event["ev"];
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
    for (const item of Object.values(ev)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (item["et"] !== "persList") continue;
      const ids: number[] = [];
      for (const [key, value] of Object.entries(item)) {
        if (key === "et") continue;
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        if (typeof value.id === "number") ids.push(value.id);
      }
      return ids;
    }
  }
  throw new Error("persList is missing from fight frames");
}

function requireRecord(value: AmfValue | undefined, label: string): Record<string, AmfValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is missing`);
  }
  return value;
}
