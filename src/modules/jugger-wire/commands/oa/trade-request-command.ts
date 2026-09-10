import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { formNick } from "./trade-form.ts";

export class TradeRequestCommand implements OaCommand {
  static readonly key = "trade|request";
  readonly key = TradeRequestCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) =>
      trade.request(accountId, formNick(envelope.form)),
    );
  }
}
