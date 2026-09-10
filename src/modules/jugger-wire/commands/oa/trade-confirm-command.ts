import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { formTrayId } from "./trade-form.ts";

export class TradeConfirmCommand implements OaCommand {
  static readonly key = "trade|confirm";
  readonly key = TradeConfirmCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) =>
      trade.confirm(accountId, formTrayId(envelope.form)),
    );
  }
}
