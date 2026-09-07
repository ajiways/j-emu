export function parseDecimalId(value: string, label: string): bigint {
  if (!/^[0-9]+$/.test(value)) throw new Error(`${label} is not a decimal id: ${value}`);
  return BigInt(value);
}

export function requireSafeWireInteger(value: bigint, label: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} ${value} exceeds the safe integer range`);
  }
  return Number(value);
}

const WIRE_IDENTITY_MIN = 1;
const WIRE_IDENTITY_MAX = 2_147_483_647;
const FIGHT_SAFE_ITEM_ID_MIN = 100_000n;
const FIGHT_SAFE_ITEM_ID_MAX = 2_147_483_647n;

export function requireWireIdentity(value: number, label: string): number {
  if (!Number.isInteger(value) || value < WIRE_IDENTITY_MIN || value > WIRE_IDENTITY_MAX) {
    throw new Error(`${label} ${value} is outside the wire identity range`);
  }
  return value;
}

export function requireFightSafeItemId(value: bigint): number {
  if (value < FIGHT_SAFE_ITEM_ID_MIN || value > FIGHT_SAFE_ITEM_ID_MAX) {
    throw new Error(`Item id ${value} is outside the fight-safe range`);
  }
  return Number(value);
}
