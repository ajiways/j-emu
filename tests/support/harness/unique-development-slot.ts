import { randomInt } from "node:crypto";

export function uniqueDevelopmentSlot(): number {
  return randomInt(1, 2_147_483_647);
}
