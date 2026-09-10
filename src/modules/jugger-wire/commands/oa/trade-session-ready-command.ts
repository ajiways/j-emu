import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { formConfirmKey } from "./trade-form.ts";

export class TradeSessionReadyCommand implements OaCommand {
  static readonly key = "trade|session_ready";
  readonly key = TradeSessionReadyCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) =>
      trade.ready(accountId, formConfirmKey(envelope.form)),
    );
  }
}
