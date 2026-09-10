import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { formItemId, formPutAmount } from "./trade-form.ts";

export class TradePutCommand implements OaCommand {
  static readonly key = "trade|put";
  readonly key = TradePutCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) =>
      trade.put(accountId, formItemId(envelope.form), formPutAmount(envelope.form)),
    );
  }
}
