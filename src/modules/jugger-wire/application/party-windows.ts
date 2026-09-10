import type { UserMacroToken } from "./user-macro.ts";

export function inviteWindow(
  partyId: number,
  userToken: UserMacroToken,
  banKey: string,
): Readonly<Record<string, unknown>> {
  return {
    title: "Приглашение в группу",
    image: "images/invite_group.jpg",
    text: `Игрок ${userToken.token} приглашает Вас вступить в группу.`,
    macroses: { [userToken.key]: userToken.macro },
    ban_keys: [banKey],
    buttons: [
      {
        caption: "Вступить",
        action: {
          object: "party",
          action: "confirm_invite",
          form: { party: String(partyId) },
        },
      },
      {
        caption: "Отказаться",
        action: {
          object: "party",
          action: "decline_invite",
          form: { party: String(partyId) },
        },
      },
      { caption: "Игнорировать", ban_key: banKey },
    ],
  };
}

export function joinRequestWindow(
  partyId: number,
  applicantNick: string,
  userToken: UserMacroToken,
  banKey: string,
): Readonly<Record<string, unknown>> {
  return {
    title: "Заявка в группу",
    image: "images/invite_group.jpg",
    text: `Игрок ${userToken.token} хочет вступить в вашу группу.`,
    macroses: { [userToken.key]: userToken.macro },
    ban_keys: [banKey],
    buttons: [
      {
        caption: "Принять",
        action: {
          object: "party",
          action: "confirm_join",
          form: { party: String(partyId), nick: applicantNick },
        },
      },
      {
        caption: "Отклонить",
        action: {
          object: "party",
          action: "decline_join",
          form: { party: String(partyId), nick: applicantNick },
        },
      },
      { caption: "Игнорировать", ban_key: banKey },
    ],
  };
}
