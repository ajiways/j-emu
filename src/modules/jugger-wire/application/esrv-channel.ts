import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export function personalEsrvChannel(accountId: number): string {
  return `2:${requireWireIdentity(accountId, "account id")}`;
}

export function areaEsrvChannel(areaId: string): string {
  if (!areaId) throw new Error("Area id is required");
  return `131:${areaId}`;
}
