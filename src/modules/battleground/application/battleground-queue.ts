import type { Clock } from "../../../shared/kernel/clock.ts";
import type { DelayScheduler } from "../../../shared/kernel/delay-scheduler.ts";
import { BattlegroundDeniedError } from "../domain/battleground-denied-error.ts";
import { formatBanError, type BattlegroundDefinition } from "../domain/battleground-definition.ts";

export type QueueHero = Readonly<{
  heroId: number;
  accountId: number;
  nick: string;
  level: number;
}>;

type Waiter = QueueHero & Readonly<{ joinedUnix: number }>;

type Invite = {
  readonly a: QueueHero;
  readonly b: QueueHero;
  readonly hideUnix: number;
  readonly confirmed: Set<number>;
};

export type QueueConfirmResult =
  Readonly<{ kind: "pending" }> | Readonly<{ kind: "matched"; a: QueueHero; b: QueueHero }>;

export type FormedInvite = Readonly<{
  a: QueueHero;
  b: QueueHero;
  hideUnix: number;
}>;

export class BattlegroundQueue {
  private readonly waiting: Waiter[] = [];
  private readonly invites = new Map<number, Invite>();
  private readonly bans = new Map<number, number>();
  private runningMatches = 0;

  constructor(
    private readonly definition: BattlegroundDefinition,
    private readonly clock: Clock,
    private readonly delay: DelayScheduler,
    private readonly onInvite: (invite: FormedInvite) => void,
  ) {}

  overlay(heroId: number): Readonly<{
    requestCount: number;
    userInQueue: 0 | 1;
    bgCount: number;
    penaltyTime: number;
    hasAnyRequest: 0 | 1;
  }> {
    const invite = this.invites.get(heroId);
    const inWaiting = this.waiting.some((row) => row.heroId === heroId);
    return {
      requestCount: this.waiting.length + (invite ? 2 : 0),
      userInQueue: inWaiting || invite ? 1 : 0,
      bgCount: this.runningMatches,
      penaltyTime: this.remainingBan(heroId),
      hasAnyRequest: inWaiting || invite ? 1 : 0,
    };
  }

  add(hero: QueueHero): void {
    this.assertPlayableLevel(hero.level);
    const ban = this.remainingBan(hero.heroId);
    if (ban > 0) throw new BattlegroundDeniedError(formatBanError(ban));
    if (this.waiting.some((row) => row.heroId === hero.heroId) || this.invites.has(hero.heroId)) {
      return;
    }
    this.waiting.push({ ...hero, joinedUnix: this.clock.unixSeconds() });
    this.tryMatch();
  }

  delete(heroId: number): void {
    const waitingIndex = this.waiting.findIndex((row) => row.heroId === heroId);
    if (waitingIndex >= 0) {
      this.waiting.splice(waitingIndex, 1);
      return;
    }
    const invite = this.invites.get(heroId);
    if (!invite) throw new BattlegroundDeniedError("Заявка не найдена!");
    const other = invite.a.heroId === heroId ? invite.b : invite.a;
    this.dropInvite(invite);
    this.bans.set(heroId, this.clock.unixSeconds() + this.definition.banSec);
    this.waiting.push({ ...other, joinedUnix: this.clock.unixSeconds() });
    this.tryMatch();
  }

  confirm(heroId: number): QueueConfirmResult {
    const invite = this.invites.get(heroId);
    if (!invite) throw new BattlegroundDeniedError("Заявка не найдена!");
    invite.confirmed.add(heroId);
    if (invite.confirmed.size < 2) return { kind: "pending" };
    this.dropInvite(invite);
    return { kind: "matched", a: invite.a, b: invite.b };
  }

  noteMatchEnded(): void {
    if (this.runningMatches < 1) throw new Error("No running battleground match to end");
    this.runningMatches -= 1;
  }

  noteMatchStarted(): void {
    this.runningMatches += 1;
  }

  inviteHideUnix(heroId: number): number | null {
    return this.invites.get(heroId)?.hideUnix ?? null;
  }

  private tryMatch(): void {
    if (this.waiting.length < 2) return;
    const a = this.waiting.shift();
    const b = this.waiting.shift();
    if (!a || !b) throw new Error("Battleground queue match is missing a waiter");
    const hideUnix = this.clock.unixSeconds() + this.definition.inviteTtlSec;
    const invite: Invite = { a, b, hideUnix, confirmed: new Set() };
    this.invites.set(a.heroId, invite);
    this.invites.set(b.heroId, invite);
    this.delay.schedule({
      token: inviteToken(a.heroId, b.heroId),
      dueAt: new Date(hideUnix * 1000),
      run: () => this.expireInvite(invite),
    });
    this.onInvite({ a, b, hideUnix });
  }

  private expireInvite(invite: Invite): void {
    if (!this.invites.has(invite.a.heroId)) return;
    this.dropInvite(invite);
    const until = this.clock.unixSeconds() + this.definition.banSec;
    for (const hero of [invite.a, invite.b]) {
      if (invite.confirmed.has(hero.heroId)) {
        this.waiting.push({ ...hero, joinedUnix: this.clock.unixSeconds() });
      } else {
        this.bans.set(hero.heroId, until);
      }
    }
    this.tryMatch();
  }

  private dropInvite(invite: Invite): void {
    this.delay.cancel(inviteToken(invite.a.heroId, invite.b.heroId));
    this.invites.delete(invite.a.heroId);
    this.invites.delete(invite.b.heroId);
  }

  private remainingBan(heroId: number): number {
    const until = this.bans.get(heroId);
    if (until === undefined) return 0;
    const remain = until - this.clock.unixSeconds();
    if (remain <= 0) {
      this.bans.delete(heroId);
      return 0;
    }
    return remain;
  }

  private assertPlayableLevel(level: number): void {
    if (level < this.definition.levelMin || level > this.definition.levelMax) {
      throw new BattlegroundDeniedError("Вы не попадаете в заданные уровневые группы!");
    }
  }
}

function inviteToken(a: number, b: number): string {
  return `bg-invite:${a}:${b}`;
}
