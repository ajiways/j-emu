import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { encodePlainFrames } from "../../amf/framing.ts";
import type { FightWireMapper } from "../../application/fight-wire-mapper.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { FproxyCommandRegistry } from "../../registry/fproxy-command-registry.ts";

export class FightTcpConnection {
  private accountId: string | null = null;

  constructor(
    private readonly combat: CombatPort,
    private readonly commands: FproxyCommandRegistry,
    private readonly wire: FightWireMapper,
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
    return encodePlainFrames(immediate.map((event) => this.wire.event(event)));
  }

  async poll(): Promise<Buffer> {
    const accountId = this.accountId;
    if (!accountId) throw new ProtocolError(4, "TCP fight connection is not authenticated");
    const events = await this.combat.execute(accountId, { kind: "poll" });
    return encodePlainFrames(events.map((event) => this.wire.event(event)));
  }
}
