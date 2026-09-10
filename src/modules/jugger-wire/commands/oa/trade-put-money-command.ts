import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { formMoneyAmount } from "./trade-form.ts";

export class TradePutMoneyCommand implements OaCommand {
  static readonly key = "trade|put_money";
  readonly key = TradePutMoneyCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) =>
      trade.putMoney(accountId, formMoneyAmount(envelope.form)),
    );
  }
}
