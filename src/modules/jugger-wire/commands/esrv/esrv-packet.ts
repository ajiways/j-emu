import type { FightExitBlock } from "../../application/fight-wire-mapper.ts";

export type EsrvFightExitPacket = Readonly<{
  channel: string;
  ctime: number;
  object: Readonly<{ "fight|exit": FightExitBlock }>;
}>;

export type EsrvUnauthenticatedPacket = Readonly<{
  channel: "2:unauthenticated";
  ctime: 0;
  object: Readonly<{ "common|dummy": Readonly<{ status: 4; error: string }> }>;
}>;

export function esrvUnauthenticatedPacket(): EsrvUnauthenticatedPacket {
  return {
    channel: "2:unauthenticated",
    ctime: 0,
    object: { "common|dummy": { status: 4, error: "No active session" } },
  };
}
