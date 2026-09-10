import { TradeSessions } from "./application/trade-sessions.ts";

export class TradeModule {
  private constructor(readonly sessions: TradeSessions) {}

  static create(): TradeModule {
    return new TradeModule(new TradeSessions());
  }

  async close(): Promise<void> {}
}
