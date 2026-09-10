import type { TradeDesk } from "../../../app/trade-desk.ts";
import type { TradeResult } from "../../../app/trade-desk.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { TradeBagTakeError } from "../../inventory/domain/trade-bag-take-error.ts";
import { TradeDeniedError } from "../../trade/domain/trade-denied-error.ts";
import type { EsrvOutbox } from "./esrv-outbox.ts";
import type { BootstrapReadModel } from "./bootstrap-read-model.ts";
import { ProtocolError } from "./protocol-error.ts";
import { tradeInviteWindow } from "./trade-invite-window.ts";
import { buildTradeSessionBlock, closedTradeSession } from "./trade-session-block.ts";
import { emptyUserMagic } from "./user-magic-block.ts";
import type { OaEncodedResponse } from "../commands/oa/oa-command.ts";

export class TradeMutation {
  constructor(
    private readonly trade: TradeDesk,
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
  ) {}

  async execute(
    oaKey: string,
    run: (trade: TradeDesk) => Promise<TradeResult>,
  ): Promise<OaEncodedResponse> {
    try {
      const result = await run(this.trade);
      await this.notifyPeer(oaKey, result);
      return { kind: "flat", blocks: await this.viewerBlocks(oaKey, result) };
    } catch (error) {
      if (error instanceof TradeDeniedError) throw new ProtocolError(203, error.message);
      if (error instanceof TradeBagTakeError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  private async notifyPeer(oaKey: string, result: TradeResult): Promise<void> {
    if (result.invite) {
      this.outbox.enqueue(result.invite.targetAccountId, {
        "common|window": tradeInviteWindow(result.invite),
      });
      this.wake.wake(result.invite.targetAccountId);
      return;
    }
    const peerAccountId = result.peerAccountId;
    if (peerAccountId === null) return;
    this.outbox.enqueue(peerAccountId, await this.peerBlocks(oaKey, result, peerAccountId));
    this.wake.wake(peerAccountId);
  }

  private async viewerBlocks(
    oaKey: string,
    result: TradeResult,
  ): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(result.viewerAccountId);
    const session = result.session
      ? await buildTradeSessionBlock(hero, result.session, this.inventory, this.catalog)
      : closedTradeSession();
    const state = await this.bootstrap.state(result.viewerAccountId);
    if (result.settled) {
      return {
        [oaKey]: { status: 100 },
        "trade|session": session,
        "user|magic": emptyUserMagic(),
        "user|bag": await this.bootstrap.bag(result.viewerAccountId),
        state,
      };
    }
    if (result.closed) {
      return {
        [oaKey]: { status: 100 },
        "trade|session": session,
        "user|bag": await this.bootstrap.bag(result.viewerAccountId),
        state,
      };
    }
    return {
      [oaKey]: { status: 100 },
      "trade|session": session,
      state,
    };
  }

  private async peerBlocks(
    oaKey: string,
    result: TradeResult,
    peerAccountId: number,
  ): Promise<Readonly<Record<string, unknown>>> {
    const hero = await this.requireHero(peerAccountId);
    if (result.settled) {
      return {
        "trade|session": closedTradeSession(),
        "user|magic": emptyUserMagic(),
        "user|bag": await this.bootstrap.bag(hero.accountId),
        state: await this.bootstrap.state(hero.accountId),
      };
    }
    if (result.closed) {
      return {
        "trade|session": closedTradeSession(),
        "user|bag": await this.bootstrap.bag(hero.accountId),
        state: await this.bootstrap.state(hero.accountId),
      };
    }
    if (!result.session) throw new Error("Open trade peer notify requires a session");
    const session = await buildTradeSessionBlock(
      hero,
      result.session,
      this.inventory,
      this.catalog,
    );
    if (
      oaKey === "trade|session_ready" ||
      oaKey === "trade|session_decline" ||
      oaKey === "trade|session_confirm"
    ) {
      return { "trade|session": session };
    }
    return {
      "trade|session": session,
      state: await this.bootstrap.state(hero.accountId),
    };
  }

  private async requireHero(accountId: number) {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
