import { PartyDeniedError } from "./party-denied-error.ts";

export const FLAG_KILL_ALL = 2;
export const FLAG_JOIN_CONFIRM = 4;

export function partyFlagSet(value: unknown): boolean {
  if (value === true || value === 1 || value === "1") return true;
  return typeof value === "string" && value.toLowerCase() === "true";
}

export function flagsFromBits(flags: number): Readonly<{
  kill_all: boolean;
  join_confirm: boolean;
}> {
  return {
    kill_all: (flags & FLAG_KILL_ALL) !== 0,
    join_confirm: (flags & FLAG_JOIN_CONFIRM) !== 0,
  };
}

export function bitsFromFlags(
  opts: Readonly<{
    kill_all?: unknown;
    join_confirm?: unknown;
    flags?: unknown;
  }>,
): number {
  if (opts.flags != null && opts.flags !== "") {
    const parsed = Number(opts.flags);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new PartyDeniedError("flags invalid");
    }
    return parsed;
  }
  let flags = 0;
  if (partyFlagSet(opts.kill_all)) flags |= FLAG_KILL_ALL;
  if (partyFlagSet(opts.join_confirm)) flags |= FLAG_JOIN_CONFIRM;
  return flags;
}
