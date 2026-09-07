import type { FightExit } from "../../../combat/ports/combat-port.ts";
import type { FightWireMapper } from "../../application/fight-wire-mapper.ts";
import type { EsrvFightExitPacket } from "./esrv-packet.ts";

export class FightExitEncoder {
  static readonly key = "fight-exit";
  readonly key: string = FightExitEncoder.key;

  constructor(private readonly wire: FightWireMapper) {}

  encode(accountId: number, exit: FightExit, now: number): EsrvFightExitPacket {
    return {
      channel: `2:${accountId}`,
      ctime: now,
      object: { "fight|exit": this.wire.exit(exit) },
    };
  }
}
