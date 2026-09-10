import { buildUserMacro } from "./user-macro.ts";
import { tradeBanKey } from "../../trade/domain/trade-confirm-key.ts";

export type TradeInviteWindowInput = Readonly<{
  trayId: number;
  targetHeroId: number;
  initiatorNick: string;
  initiatorLevel: number;
  initiatorKind: number;
}>;

export type TradeInviteWindowBlock = Readonly<{
  status: 100;
  title: "Предложение торговли";
  image: "images/trade.png";
  text: string;
  macroses: Readonly<Record<string, unknown>>;
  ban_keys: readonly string[];
  buttons: readonly object[];
}>;

export function tradeInviteWindow(invite: TradeInviteWindowInput): TradeInviteWindowBlock {
  const user = buildUserMacro({
    nick: invite.initiatorNick,
    level: invite.initiatorLevel,
    kind: invite.initiatorKind,
  });
  const banKey = tradeBanKey(invite.trayId, invite.targetHeroId);
  return {
    status: 100,
    title: "Предложение торговли",
    image: "images/trade.png",
    text: `Пользователь ${user.token}<br> хочет с Вами торговать.`,
    macroses: { [user.key]: user.macro },
    ban_keys: [banKey],
    buttons: [
      {
        caption: "Согласиться",
        action: {
          object: "trade",
          action: "confirm",
          form: { tray_id: invite.trayId },
        },
      },
      {
        caption: "Отказаться",
        action: {
          object: "trade",
          action: "decline",
          form: { tray_id: invite.trayId },
        },
      },
      { caption: "Игнорировать", ban_key: banKey },
    ],
  };
}
