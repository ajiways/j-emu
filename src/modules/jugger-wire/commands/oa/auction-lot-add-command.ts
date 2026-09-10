import type { AuctionList } from "../../../../app/auction-list.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { auctionLotAddMutation } from "../../application/auction-lot-mutation.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionLotAddCommand implements OaCommand {
  static readonly key = "auction|lot_add";
  readonly key = AuctionLotAddCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly list: AuctionList,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const form = envelope.form ?? {};
      await this.list.add({
        heroId: hero.id,
        itemId: requirePositiveInt(form.artifact_id, "предмет не найден"),
        amount: requirePositiveInt(form.amount, "предмет не найден"),
        startPriceGold: requireGold(form.start_price),
        buyoutGold: requireGold(form.buyout),
        duration: form.duration,
      });
      return {
        kind: "flat",
        blocks: auctionLotAddMutation(
          await this.bootstrap.bag(accountId),
          await this.bootstrap.state(accountId),
        ),
      };
    } catch (error) {
      if (error instanceof AuctionDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}

function requirePositiveInt(value: unknown, error: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new AuctionDeniedError(error);
  return n;
}

function requireGold(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new AuctionDeniedError("ставка слишком мала");
  return n;
}
