import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { formOptionalTrayId } from "./trade-form.ts";

export class TradeDeclineCommand implements OaCommand {
  static readonly key = "trade|decline";
  readonly key = TradeDeclineCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) =>
      trade.decline(accountId, formOptionalTrayId(envelope.form)),
    );
  }
}
