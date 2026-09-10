import type { Clock } from "../../../shared/kernel/clock.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { SessionPresence } from "../../identity/ports/session-presence.ts";
import { ProtocolError } from "./protocol-error.ts";
import type { EsrvOutbox } from "./esrv-outbox.ts";
import type { FriendlyDuelInvites } from "./friendly-duel-invites.ts";

export class ProposeFriendlyDuel {
  constructor(
    private readonly characters: CharacterService,
    private readonly sessions: SessionPresence,
    private readonly combat: CombatPort,
    private readonly catalog: Catalog,
    private readonly invites: FriendlyDuelInvites,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
    private readonly clock: Clock,
  ) {}

  async execute(accountId: number, targetNick: string): Promise<void> {
    const nick = targetNick.trim();
    if (!nick) throw new ProtocolError(203, "ник не указан");
    const challenger = await this.characters.getByAccountId(accountId);
    if (!challenger) throw new Error(`Hero for account ${accountId} is missing`);
    if (nick.toLowerCase() === challenger.nick.toLowerCase()) {
      throw new ProtocolError(203, "нельзя вызвать себя");
    }
    if (challenger.ghost) throw new ProtocolError(203, "призрак не может драться");
    if ((await this.combat.activeFightId(accountId)) !== null) {
      throw new ProtocolError(203, "уже в бою");
    }
    const target = await this.characters.getByNick(nick);
    if (!target) throw new ProtocolError(203, "игрок не в сети");
    const online = new Set(await this.sessions.listAccountIdsWithSession());
    if (!online.has(target.accountId)) throw new ProtocolError(203, "игрок не в сети");
    if (target.areaId !== challenger.areaId) {
      throw new ProtocolError(203, "игрок в другой локации");
    }
    if (target.ghost) throw new ProtocolError(203, "противник — призрак");
    if ((await this.combat.activeFightId(target.accountId)) !== null) {
      throw new ProtocolError(203, "противник уже в бою");
    }
    const appearance = await this.catalog.appearance(challenger.kind, challenger.gender);
    this.invites.put({
      fromAccountId: challenger.accountId,
      fromNick: challenger.nick,
      toAccountId: target.accountId,
      toNick: target.nick,
      createdAtMs: this.clock.now().getTime(),
    });
    this.outbox.enqueue(target.accountId, {
      "user|friendly_duel_request": {
        status: 100,
        user: {
          nick: challenger.nick,
          level: challenger.level,
          id: challenger.accountId,
          kind: challenger.kind,
          sk: challenger.sk,
          body: challenger.body,
          avatar_small: appearance.avatarSmall,
        },
      },
    });
    this.wake.wake(target.accountId);
  }
}
