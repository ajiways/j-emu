import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { formItemId, formPutAmount } from "./trade-form.ts";

export class TradeWithdrawCommand implements OaCommand {
  static readonly key = "trade|withdraw";
  readonly key = TradeWithdrawCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) =>
      trade.withdraw(accountId, formItemId(envelope.form), formPutAmount(envelope.form)),
    );
  }
}
