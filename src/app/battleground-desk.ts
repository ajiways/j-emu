import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type {
  BattlegroundQueue,
  QueueHero,
} from "../modules/battleground/application/battleground-queue.ts";
import { BattlegroundDeniedError } from "../modules/battleground/domain/battleground-denied-error.ts";
import type { BattlegroundCatalog } from "../modules/battleground/ports/battleground-catalog.ts";
import type { BattlegroundHistory } from "../modules/battleground/ports/battleground-history.ts";
import type { BattlegroundDefinition } from "../modules/battleground/domain/battleground-definition.ts";
import {
  finishedHistoryWire,
  inviteWindow,
  leaderRatingWire,
  listRow,
} from "../modules/battleground/domain/battleground-wire.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import type { BattlegroundMatchRuntime } from "./battleground-match-runtime.ts";

export type BattlegroundDeskDeps = Readonly<{
  definition: BattlegroundDefinition;
  characters: CharacterService;
  catalog: BattlegroundCatalog;
  history: BattlegroundHistory;
  queue: BattlegroundQueue;
  runtime: BattlegroundMatchRuntime;
  outbox: EsrvOutbox;
  wake: Readonly<{ wake(accountId: number): void }>;
}>;

export class BattlegroundDesk {
  constructor(private readonly deps: BattlegroundDeskDeps) {}

  async execute(
    key: string,
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    switch (key) {
      case "arena|list":
        return nested({ status: 100, list: await this.listRows(hero) });
      case "arena|bg":
        return nested({ status: 100, bg: await this.bgRow(hero, envelope) });
      case "arena|bg_request":
        return { kind: "flat", blocks: await this.request(hero, envelope) };
      case "arena|bg_running":
        return nested({
          status: 100,
          cur_page: formNumber(envelope, "page", 1),
          search: formString(envelope, "search"),
        });
      case "arena|bg_finished":
        return nested(await this.finished(envelope));
      case "arena|great_fights":
        return nested({ status: 100, fight_ids: [] });
      case "arena|leader_rating": {
        const playable = await this.deps.catalog.playable();
        return nested(leaderRatingWire(playable.leaderGroups));
      }
      default:
        throw new Error(`Battleground OA ${key} is not registered`);
    }
  }

  attack(accountId: number, nick: string) {
    return this.deps.runtime.attack(accountId, nick);
  }

  afterFightFinished(notice: Parameters<BattlegroundMatchRuntime["afterFightFinished"]>[0]) {
    return this.deps.runtime.afterFightFinished(notice);
  }

  reconcileAccount(accountId: number) {
    return this.deps.runtime.reconcileAccount(accountId);
  }

  pushInvite(invite: Readonly<{ a: QueueHero; b: QueueHero; hideUnix: number }>): void {
    const window = inviteWindow(this.deps.definition, invite.hideUnix);
    for (const hero of [invite.a, invite.b]) {
      this.deps.outbox.enqueue(hero.accountId, { "common|window": window });
      this.deps.wake.wake(hero.accountId);
    }
  }

  private async listRows(hero: Hero) {
    const cards = await this.deps.catalog.list();
    const overlay = this.deps.queue.overlay(hero.id);
    return cards.map((card) => listRow(card, overlay));
  }

  private async bgRow(hero: Hero, envelope: ObjectActionEnvelope) {
    const playable = await this.deps.catalog.playable();
    const id = formNumber(envelope, "id", 0);
    const type = formString(envelope, "type") || playable.type;
    if (!Number.isInteger(id) || id < 1) {
      throw new BattlegroundDeniedError("поле битвы не найдено");
    }
    const card = await this.deps.catalog.byKey(type, id);
    if (!card) throw new BattlegroundDeniedError("поле битвы не найдено");
    return listRow(card, this.deps.queue.overlay(hero.id));
  }

  private async request(
    hero: Hero,
    envelope: ObjectActionEnvelope,
  ): Promise<Readonly<Record<string, unknown>>> {
    const playable = await this.deps.catalog.playable();
    const id = formNumber(envelope, "id", formNumber(envelope, "bg_id", 0));
    const status = formString(envelope, "status").toLowerCase();
    if (id && id !== playable.id) throw new BattlegroundDeniedError("Заявка не найдена!");
    const queued: QueueHero = {
      heroId: hero.id,
      accountId: hero.accountId,
      nick: hero.nick,
      level: hero.level,
    };
    if (status === "add") {
      if (id !== playable.id) throw new BattlegroundDeniedError("Заявка не найдена!");
      this.deps.queue.add(queued);
    } else if (status === "delete" || status === "remove") {
      if (id !== 0 && id !== playable.id) throw new BattlegroundDeniedError("Заявка не найдена!");
      this.deps.queue.delete(hero.id);
    } else if (status === "confirm") {
      if (id !== 0 && id !== playable.id) throw new BattlegroundDeniedError("Заявка не найдена!");
      const result = this.deps.queue.confirm(hero.id);
      if (result.kind === "matched") await this.deps.runtime.startMatch(result.a, result.b);
    } else throw new BattlegroundDeniedError("Заявка не найдена!");
    const overlay = this.deps.queue.overlay(hero.id);
    return {
      "arena|bg_request": {
        status: 100,
        user_in_queue: overlay.userInQueue,
        bg_id: String(playable.id),
      },
      "arena|bg": { status: 100, bg: listRow(playable, overlay) },
    };
  }

  private async finished(envelope: ObjectActionEnvelope) {
    const playable = await this.deps.catalog.playable();
    const page = await this.deps.history.list({
      bgId: formString(envelope, "bg_id") || formString(envelope, "id") || String(playable.id),
      page: formNumber(envelope, "page", 1),
      search: formString(envelope, "search"),
    });
    return {
      status: 100,
      bgs: page.matches.map(finishedHistoryWire),
      cur_page: page.page,
      pages: page.pages,
      search: page.search,
    };
  }

  private async requireHero(accountId: number): Promise<Hero> {
    const hero = await this.deps.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}

function nested(value: object): OaEncodedResponse {
  return { kind: "nested", value };
}

function formString(envelope: ObjectActionEnvelope, key: string): string {
  const raw = envelope.form?.[key] ?? envelope.input?.[key];
  if (raw === undefined || raw === null) return "";
  return String(raw);
}

function formNumber(envelope: ObjectActionEnvelope, key: string, fallback: number): number {
  const raw = envelope.form?.[key] ?? envelope.input?.[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return value;
}
