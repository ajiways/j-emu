import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { encodePlainFrames } from "../../amf/framing.ts";
import { FightTraceLog, type FightTraceSink } from "../../application/fight-trace-log.ts";
import type { FightWireMapper } from "../../application/fight-wire-mapper.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import {
  decodeFightRequest,
  type FproxyCommandRegistry,
} from "../../registry/fproxy-command-registry.ts";

export class FightTcpConnection {
  private accountId: number | null = null;

  get authenticatedAccountId(): number | null {
    return this.accountId;
  }

  constructor(
    private readonly combat: CombatPort,
    private readonly commands: FproxyCommandRegistry,
    private readonly wire: FightWireMapper,
    private readonly log: FightTraceSink,
  ) {}

  async receive(payload: Buffer): Promise<Buffer> {
    const command = this.commands.decodePayload(payload);
    if (command.kind === "poll") {
      throw new ProtocolError(203, "TCP poll must use poll()");
    }
    if (command.kind === "authenticate") {
      const accountId = await this.combat.accountForFight(command.fightId);
      if (!accountId) throw new ProtocolError(203, `Fight ${command.fightId} was not found`);
      this.accountId = accountId;
    }
    const accountId = this.accountId;
    if (!accountId) throw new ProtocolError(4, "TCP fight connection is not authenticated");
    const immediate = await this.combat.execute(accountId, command);
    const pocketItemId = this.combat.takePocketConsume(accountId);
    if (pocketItemId !== null) {
      throw new Error("TCP fproxy cannot persist pocket consume");
    }
    const frames = this.wire.frames(immediate);
    FightTraceLog.write(this.log, {
      channel: "tcp",
      accountId,
      command,
      request: decodeFightRequest(payload),
      events: immediate,
      frames,
    });
    return encodePlainFrames(frames);
  }

  async poll(): Promise<Buffer> {
    const accountId = this.accountId;
    if (!accountId) return Buffer.alloc(0);
    const command = { kind: "poll" as const };
    const events = await this.combat.execute(accountId, command);
    const frames = this.wire.frames(events);
    FightTraceLog.write(this.log, {
      channel: "tcp",
      accountId,
      command,
      request: null,
      events,
      frames,
    });
    return encodePlainFrames(frames);
  }
}
