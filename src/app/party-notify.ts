import type { ChatDesk } from "./chat-desk.ts";
import type { Clock } from "../shared/kernel/clock.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import { lootRulesLabel } from "../modules/party/domain/loot-rules-label.ts";
import { partyChannel } from "../modules/party/domain/party-channel.ts";
import { buildFightJoinActionMacro } from "../modules/chat/domain/action-macro.ts";
import { buildMoneyMacro } from "../modules/chat/domain/money-macro.ts";
import { goldWireString } from "../modules/combat/domain/fight-money.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import { buildChatMessage, type ChatMessageBlock } from "../modules/chat/domain/chat-message.ts";
import { buildUserMacro } from "../modules/jugger-wire/application/user-macro.ts";
import { emptyMembersPayload } from "../modules/jugger-wire/application/party-wire.ts";

export type PartyNotifyDeps = Readonly<{
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
  chat: ChatDesk;
  clock: Clock;
  memberAccountIds(partyId: number): Promise<readonly number[]>;
}>;

export class PartyNotify {
  constructor(private readonly deps: PartyNotifyDeps) {}

  async pushToParty(partyId: number, fragment: object): Promise<void> {
    const channel = partyChannel(partyId);
    for (const accountId of await this.deps.memberAccountIds(partyId)) {
      this.enqueue(accountId, fragment, channel);
    }
  }

  personal(accountId: number, fragment: object): void {
    this.enqueue(accountId, fragment);
  }

  personalEmpty(accountId: number, state: object): void {
    this.enqueue(accountId, {
      "party|members": emptyMembersPayload(),
      state,
    });
  }

  async chatInviteSent(inviter: Hero, target: Hero): Promise<void> {
    const token = buildUserMacro({ nick: target.nick, level: target.level, kind: target.kind });
    await this.deps.chat.deliverSystem(
      inviter.accountId,
      `Вы пригласили ${token.token} в группу.`,
      {
        [token.key]: token.macro,
      },
    );
  }

  async chatJoin(partyId: number, joiner: Hero): Promise<void> {
    const token = buildUserMacro({ nick: joiner.nick, level: joiner.level, kind: joiner.kind });
    await this.partySystem(
      partyId,
      `Игрок ${token.token} вступил в вашу группу.`,
      joiner.language,
      {
        macroses: { [token.key]: token.macro },
        excludedAccountId: joiner.accountId,
      },
    );
    await this.deps.chat.deliverSystem(joiner.accountId, "Вы успешно приняты в группу!");
  }

  async chatDecline(decliner: Hero, leaderAccountId: number): Promise<void> {
    const token = buildUserMacro({
      nick: decliner.nick,
      level: decliner.level,
      kind: decliner.kind,
    });
    await this.deps.chat.deliverSystem(
      leaderAccountId,
      `Игрок ${token.token} отказался от участия в группе.`,
      { [token.key]: token.macro },
    );
  }

  async chatKick(partyId: number, kicked: Hero, leader: Hero): Promise<void> {
    const kickedToken = buildUserMacro({
      nick: kicked.nick,
      level: kicked.level,
      kind: kicked.kind,
    });
    await this.partySystem(
      partyId,
      `Лидер группы выгнал игрока ${kickedToken.token} из группы.`,
      leader.language,
      {
        macroses: { [kickedToken.key]: kickedToken.macro },
        excludedAccountId: kicked.accountId,
      },
    );
    const lead = buildUserMacro({ nick: leader.nick, level: leader.level, kind: leader.kind });
    await this.deps.chat.deliverSystem(
      kicked.accountId,
      `Лидер группы ${lead.token} выгнал Вас из группы.`,
      { [lead.key]: lead.macro },
    );
  }

  async chatDisband(
    partyId: number,
    leader: Hero,
    memberAccounts: readonly number[],
  ): Promise<void> {
    const token = buildUserMacro({ nick: leader.nick, level: leader.level, kind: leader.kind });
    const block = this.message(leader.language, `Игрок ${token.token} расформировал группу.`, {
      macroses: { [token.key]: token.macro },
    });
    const channel = partyChannel(partyId);
    for (const accountId of memberAccounts) {
      this.enqueue(accountId, { "chat|message": block }, channel);
    }
  }

  async chatRulesChange(partyId: number, rules: string, lng: string): Promise<void> {
    const label = lootRulesLabel(rules);
    if (!label) return;
    await this.partySystem(
      partyId,
      `Лидер группы изменил правила распределения на "${label}".`,
      lng,
    );
  }

  async chatGive(
    partyId: number,
    giver: Hero,
    receiver: Hero,
    items: readonly { artikulId: number; amount: number }[],
  ): Promise<void> {
    const from = buildUserMacro({ nick: giver.nick, level: giver.level, kind: giver.kind });
    const to = buildUserMacro({ nick: receiver.nick, level: receiver.level, kind: receiver.kind });
    const macroses: Record<string, unknown> = { [from.key]: from.macro, [to.key]: to.macro };
    const parts: string[] = [];
    for (const item of items) {
      if (item.amount < 1) continue;
      const token = await this.artifactToken(item.artikulId);
      macroses[token.key] = token.macro;
      parts.push(`${token.token} (${item.amount})`);
    }
    if (parts.length < 1) throw new Error("Party give chat requires at least one item");
    const itemPart = parts.join(", ");
    await this.partySystem(
      partyId,
      `${from.token} передал вещи ${itemPart} игроку ${to.token}`,
      giver.language,
      { macroses },
    );
    await this.deps.chat.deliverSystem(
      receiver.accountId,
      `Вам переданы вещи ${itemPart}`,
      macroses,
    );
  }

  async chatLotteryRoll(partyId: number, hero: Hero, roll: number): Promise<void> {
    const token = buildUserMacro({ nick: hero.nick, level: hero.level, kind: hero.kind });
    await this.partySystem(partyId, `${token.token} выбросил <b>${roll}!</b>`, hero.language, {
      macroses: { [token.key]: token.macro },
    });
  }

  async chatLotteryTie(partyId: number, lng: string): Promise<void> {
    await this.partySystem(partyId, "Ничья! Переброс.", lng);
  }

  async chatLotteryWin(partyId: number, winner: Hero, artikulId: number): Promise<void> {
    const user = buildUserMacro({ nick: winner.nick, level: winner.level, kind: winner.kind });
    const item = await this.artifactToken(artikulId);
    await this.partySystem(
      partyId,
      `${user.token} <b>победил</b> и получает предмет ${item.token}.`,
      winner.language,
      { macroses: { [user.key]: user.macro, [item.key]: item.macro } },
    );
  }

  async chatGroupMoney(partyId: number, moneyMinor: number, lng: string): Promise<void> {
    if (moneyMinor < 1) return;
    const gold = Number(goldWireString(moneyMinor));
    const money = buildMoneyMacro(gold, "1");
    await this.partySystem(partyId, `Вашей группой найдено: ${money.token}`, lng, {
      macroses: { [money.key]: money.macro },
    });
  }

  async chatGroupItem(
    partyId: number,
    artikulId: number,
    amount: number,
    lng: string,
  ): Promise<void> {
    const token = await this.artifactToken(artikulId);
    await this.partySystem(partyId, `Вашей группой получено: ${token.token} ${amount} шт.`, lng, {
      macroses: { [token.key]: token.macro },
    });
  }

  async chatFightHelp(
    partyId: number,
    fighter: Hero,
    fightId: string,
    fightTitle: string,
  ): Promise<void> {
    const user = buildUserMacro({ nick: fighter.nick, level: fighter.level, kind: fighter.kind });
    const action = buildFightJoinActionMacro(fightId, 1);
    await this.partySystem(
      partyId,
      `Член группы ${user.token} начал бой ${fightTitle}. ${action.token}`,
      fighter.language,
      {
        macroses: { [user.key]: user.macro, [action.key]: action.macro },
        excludedAccountId: fighter.accountId,
      },
    );
  }

  private async artifactToken(artikulId: number) {
    return this.deps.chat.artifactMacro(artikulId);
  }

  private async partySystem(
    partyId: number,
    msg: string,
    lng: string,
    opts: Readonly<{
      macroses?: Readonly<Record<string, unknown>>;
      excludedAccountId?: number;
    }> = {},
  ): Promise<void> {
    const block = this.message(lng, msg, opts);
    const channel = partyChannel(partyId);
    const accounts = new Set(await this.deps.memberAccountIds(partyId));
    for (const accountId of accounts) {
      this.enqueue(accountId, { "chat|message": block }, channel);
    }
  }

  private message(
    lng: string,
    msg: string,
    opts: Readonly<{
      macroses?: Readonly<Record<string, unknown>>;
      excludedAccountId?: number;
    }> = {},
  ): ChatMessageBlock {
    return buildChatMessage({
      type: "system",
      msg,
      lng,
      ctime: this.deps.clock.unixSeconds(),
      ...(opts.macroses ? { macroses: opts.macroses } : {}),
      ...(opts.excludedAccountId !== undefined
        ? { excluded_user_id: String(opts.excludedAccountId) }
        : {}),
    });
  }

  private enqueue(accountId: number, fragment: object, channel?: string): void {
    this.deps.outbox.enqueue(accountId, fragment, channel);
    this.deps.wake.wake(accountId);
  }
}
