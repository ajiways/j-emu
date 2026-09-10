import type { TradeMutation } from "../../application/trade-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class TradeSessionDeclineCommand implements OaCommand {
  static readonly key = "trade|session_decline";
  readonly key = TradeSessionDeclineCommand.key;

  constructor(private readonly mutation: TradeMutation) {}

  execute(accountId: number): Promise<OaEncodedResponse> {
    return this.mutation.execute(this.key, (trade) => trade.sessionDecline(accountId));
  }
}
