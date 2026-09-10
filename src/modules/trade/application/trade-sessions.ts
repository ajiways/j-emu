import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { newConfirmKey } from "../domain/trade-confirm-key.ts";
import { TradeDeniedError } from "../domain/trade-denied-error.ts";
import type { TradeSession, TradeTray } from "../domain/trade-session.ts";

const MAX_WIRE_ID = 2_147_483_647;

export type TradeHeroRef = Readonly<{
  id: number;
  accountId: number;
  nick: string;
  kind: number;
  level: number;
}>;

export class TradeSessions {
  private readonly byHero = new Map<number, TradeSession>();
  private readonly byTray = new Map<number, TradeSession>();
  private nextTrayId = 1;
  private gate = Promise.resolve();

  async serial<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.gate;
    let release!: () => void;
    this.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  hasHero(heroId: number): boolean {
    requireWireIdentity(heroId, "hero id");
    return this.byHero.has(heroId);
  }

  sessionForHero(heroId: number): TradeSession | undefined {
    requireWireIdentity(heroId, "hero id");
    return this.byHero.get(heroId);
  }

  sessionForTray(trayId: number): TradeSession | undefined {
    requireWireIdentity(trayId, "trade tray id");
    return this.byTray.get(trayId);
  }

  requireOpen(heroId: number): { session: TradeSession; mine: TradeTray } {
    const session = this.sessionForHero(heroId);
    if (!session) throw new TradeDeniedError("нет сессии обмена");
    const mine = session.trays.get(heroId);
    if (!mine) throw new TradeDeniedError("нет сессии обмена");
    return { session, mine };
  }

  openRequest(initiator: TradeHeroRef, target: TradeHeroRef): TradeSession {
    const mine = this.emptyTray(initiator);
    const session: TradeSession = {
      confirmKey: newConfirmKey(),
      initiatorHeroId: initiator.id,
      inviteeHeroId: null,
      pendingInviteeHeroId: target.id,
      pendingInviteeAccountId: target.accountId,
      trays: new Map([[initiator.id, mine]]),
    };
    this.byHero.set(initiator.id, session);
    this.byHero.set(target.id, session);
    this.byTray.set(mine.id, session);
    return session;
  }

  acceptInvite(invitee: TradeHeroRef, trayId: number): TradeSession {
    const session = this.sessionForTray(trayId);
    if (!session) throw new TradeDeniedError("предложение обмена недействительно");
    if (session.pendingInviteeHeroId !== invitee.id) {
      throw new TradeDeniedError("это предложение не вам");
    }
    if (session.inviteeHeroId !== null) throw new TradeDeniedError("обмен уже принят");
    const bound = this.byHero.get(invitee.id);
    if (bound && bound !== session) throw new TradeDeniedError("уже идёт обмен");
    const mine = this.emptyTray(invitee);
    session.inviteeHeroId = invitee.id;
    session.trays.set(invitee.id, mine);
    this.byHero.set(invitee.id, session);
    this.byTray.set(mine.id, session);
    return session;
  }

  rotateKey(session: TradeSession): void {
    session.confirmKey = newConfirmKey();
    for (const tray of session.trays.values()) tray.confirmed = 0;
  }

  unbind(session: TradeSession): void {
    this.byHero.delete(session.initiatorHeroId);
    if (session.inviteeHeroId !== null) this.byHero.delete(session.inviteeHeroId);
    this.byHero.delete(session.pendingInviteeHeroId);
    for (const tray of session.trays.values()) this.byTray.delete(tray.id);
  }

  otherHeroId(session: TradeSession, heroId: number): number | null {
    if (session.initiatorHeroId === heroId) return session.inviteeHeroId;
    if (session.inviteeHeroId === heroId) return session.initiatorHeroId;
    return null;
  }

  peerTray(session: TradeSession, heroId: number): TradeTray | null {
    const otherId = this.otherHeroId(session, heroId);
    if (otherId === null) return null;
    const tray = session.trays.get(otherId);
    return tray === undefined ? null : tray;
  }

  peerAccountId(session: TradeSession, heroId: number): number | null {
    const tray = this.peerTray(session, heroId);
    if (tray) return tray.accountId;
    if (session.inviteeHeroId === null && session.pendingInviteeHeroId !== heroId) {
      return session.pendingInviteeAccountId;
    }
    return null;
  }

  private emptyTray(hero: TradeHeroRef): TradeTray {
    const id = this.nextTrayId;
    if (!Number.isInteger(id) || id < 1 || id > MAX_WIRE_ID) {
      throw new Error("Trade tray id overflow");
    }
    this.nextTrayId += 1;
    return {
      id,
      heroId: hero.id,
      accountId: hero.accountId,
      nick: hero.nick,
      kind: hero.kind,
      level: hero.level,
      confirmed: 0,
      moneyGold: 0,
      artifacts: new Map(),
    };
  }
}
