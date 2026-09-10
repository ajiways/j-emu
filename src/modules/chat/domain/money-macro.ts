import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";

export type MoneyMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<{
    amount: string;
    type: string;
    key_id: string;
    macro_type: "MONEY";
  }>;
}>;

export function buildMoneyMacro(amountGold: number, moneyType: "1" | "2" = "1"): MoneyMacroToken {
  if (!Number.isFinite(amountGold) || amountGold <= 0) {
    throw new Error("Money macro amount must be a positive gold number");
  }
  const key = macroKeyId("MONEY", `${moneyType}:${amountGold.toFixed(2)}`);
  return {
    key,
    token: `[[MONEY ${key}]]`,
    macro: {
      amount: String(amountGold),
      type: moneyType,
      key_id: key,
      macro_type: "MONEY",
    },
  };
}
