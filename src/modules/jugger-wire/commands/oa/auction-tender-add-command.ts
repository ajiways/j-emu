import type { AuctionTenderAdd } from "../../../../app/auction-tender-add.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { AuctionDeniedError } from "../../../auction/domain/auction-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { auctionTenderAddMutation } from "../../application/auction-lot-mutation.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class AuctionTenderAddCommand implements OaCommand {
  static readonly key = "auction|tender_add";
  readonly key = AuctionTenderAddCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly add: AuctionTenderAdd,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const form = envelope.form ?? {};
      await this.add.add({
        heroId: hero.id,
        artikulId: requireArtikul(form.artikul_id),
        amount: optionalAmount(form.amount),
        buyoutGold: requireGold(form.buyout),
        wholeStackOnly: Number(form.only_entirely) ? 1 : 0,
        requiredDurability: optionalFilter(form.required_durability),
        requiredDurabilityMax: optionalFilter(form.required_durability_max),
        magicId: optionalFilter(form.magic_id),
        requiredUpgradeId: optionalFilter(form.required_upgrade_id),
      });
      return {
        kind: "flat",
        blocks: auctionTenderAddMutation(
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

function requireArtikul(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new AuctionDeniedError("выберите предмет");
  return n;
}

function optionalAmount(value: unknown): number {
  if (value === undefined || value === null || value === "") return 1;
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 1) throw new AuctionDeniedError("выберите предмет");
  return n;
}

function requireGold(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new AuctionDeniedError("укажите цену заказа");
  return n;
}

function optionalFilter(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Math.floor(Number(value));
  if (!Number.isInteger(n) || n < 0) throw new AuctionDeniedError("заказ не найден");
  return n;
}
