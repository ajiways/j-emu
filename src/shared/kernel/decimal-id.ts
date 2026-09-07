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

const FIGHT_SAFE_ITEM_ID_MIN = 1_000_000_000n;
const FIGHT_SAFE_ITEM_ID_MAX = 2_147_483_647n;

export function requireFightSafeItemId(value: bigint): number {
  if (value < FIGHT_SAFE_ITEM_ID_MIN || value > FIGHT_SAFE_ITEM_ID_MAX) {
    throw new Error(`Item id ${value} is outside the fight-safe range`);
  }
  return Number(value);
}
