import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { FightFinishedNotice } from "../modules/combat/ports/fight-terminal-observer.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { FightWireMapper } from "../modules/jugger-wire/application/fight-wire-mapper.ts";
import type { BootstrapReadModel } from "../modules/jugger-wire/application/bootstrap-read-model.ts";
import { bookTrioFromSnapshot } from "../modules/jugger-wire/application/quest-book-trio.ts";
import type { BookTrioBlocks } from "../modules/jugger-wire/application/book-quest-blocks.ts";
import { ProtocolError } from "../modules/jugger-wire/application/protocol-error.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";
import type { QuestService } from "../modules/quests/application/quest-service.ts";
import type { QuestMutation } from "../modules/quests/application/quest-mutation.ts";
import { QuestDeniedError } from "../modules/quests/domain/quest-denied-error.ts";
import {
  leftoverQuestEffects,
  effectsWithoutLeftover,
} from "../modules/quests/domain/quest-script-leftover.ts";
import type { QuestSignal } from "../modules/quests/domain/quest-signal.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { applyOpenStoreLeftover, type ComeInTravel } from "./come-in-travel.ts";
import { applyQuestScriptEffect } from "./quest-script-apply.ts";
import { questAreaBegin, questAreaFinish, type QuestAreaOaDeps } from "./quest-area-oa.ts";
import {
  questAnswerBlocks,
  questBoardBlocks,
  type QuestAnswerWireDeps,
} from "./quest-answer-wire.ts";
import {
  answerIdOf,
  npcRefOf,
  questFlat as flat,
  requireQuestInt as requireInt,
} from "./quest-oa-codec.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";

export class QuestDesk {
  constructor(
    private readonly quests: QuestService,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly catalog: Catalog,
    private readonly world: WorldService,
    private readonly combat: CombatPort,
    private readonly chat: ChatDesk,
    private readonly unitOfWork: UnitOfWork,
    private readonly fightWire: FightWireMapper,
    private readonly bootstrap: BootstrapReadModel,
    private readonly random: Readonly<{ unit(): number }>,
    private readonly travel: ComeInTravel,
    private readonly presence: PresenceFanout,
  ) {}

  async execute(
    key: string,
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    try {
      if (key === "npc|info") {
        return flat({ "npc|info": await this.quests.npcInfo(npcRefOf(envelope)) });
      }
      if (key === "npc|quests") return flat(await this.openNpc(accountId, npcRefOf(envelope)));
      if (key === "npc|answer") return await this.npcAnswer(accountId, envelope);
      if (key === "book|quest_list") return await this.bookList(accountId, envelope);
      if (key === "book|quest_cancel") return await this.cancel(accountId, envelope);
      if (key === "book|quest_delete") return await this.hideJournal(accountId, envelope);
      if (key === "common|object:AREA")
        return await questAreaBegin(this.areaDeps(), accountId, envelope);
      if (key === "common|action_finish") return await questAreaFinish(this.areaDeps(), accountId);
      throw new Error(`Quest OA ${key} is not registered`);
    } catch (error) {
      if (error instanceof QuestDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  async openNpc(accountId: number, npcId: number): Promise<Record<string, unknown>> {
    const hero = await this.requireHero(accountId);
    await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      await this.quests.board(hero.id, npcId);
    });
    return questBoardBlocks(this.answerWire(), accountId, hero.id, npcId);
  }

  async afterBagChange(accountId: number, heroId: number): Promise<void> {
    await this.syncBagGoals(accountId, heroId);
  }

  async recordBuy(heroId: number, artikulId: number): Promise<BookTrioBlocks | null> {
    return this.signalBook(heroId, { kind: "buy", artikulId });
  }

  async recordEquip(heroId: number, artikulId: number): Promise<BookTrioBlocks | null> {
    return this.signalBook(heroId, { kind: "equip", artikulId });
  }

  async afterFinished(notice: FightFinishedNotice): Promise<void> {
    if (notice.purpose === "quest" && (notice.outcome === "win" || notice.outcome === "loss")) {
      const msg = notice.outcome === "win" ? notice.chatWin : notice.chatLose;
      if (msg) await this.chat.deliverSystem(notice.accountId, msg);
    }
    if (notice.outcome !== "win") return;
    const hero = await this.characters.getByAccountId(notice.accountId);
    if (!hero) throw new Error(`Hero for account ${notice.accountId} is missing`);
    await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      if (notice.botId && notice.skipQuestKills !== true) {
        await this.applyEffects(
          notice.accountId,
          hero.id,
          await this.quests.recordSignal(hero.id, { kind: "kill", artikulId: notice.botId }),
        );
      }
      if (notice.purpose === "quest") {
        await this.applyEffects(
          notice.accountId,
          hero.id,
          await this.quests.recordSignal(hero.id, { kind: "win_fight" }),
        );
        await this.applyEffects(
          notice.accountId,
          hero.id,
          await this.quests.completeParkedAreaFight(hero.id),
        );
      }
      await this.syncBagGoals(notice.accountId, hero.id);
    });
  }

  async bookTrio(heroId: number, filterType: string): Promise<BookTrioBlocks> {
    return bookTrioFromSnapshot(await this.quests.bookSnapshot(heroId, filterType));
  }

  private async npcAnswer(
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const fields = { ...(envelope.form ?? {}), ...(envelope.root ?? {}) };
    const leftover = await this.unitOfWork.run(async () => {
      const locked = await this.characters.lockById(hero.id);
      const mutation = await this.applyEffects(
        accountId,
        hero.id,
        await this.quests.answer(
          hero.id,
          {
            npcRef: npcRefOf(envelope),
            pointId: requireInt(fields["point_id"], "point_id"),
            answerId: answerIdOf(fields["answer_id"]),
          },
          hero.level,
        ),
      );
      return {
        mutation,
        moved: await applyOpenStoreLeftover(this.travel, accountId, locked, mutation.effects),
      };
    });
    if (leftover.moved) {
      await this.presence.afterMove(
        accountId,
        leftover.moved.fromAreaId,
        leftover.moved.toAreaId,
        leftover.moved.fromCopyId,
      );
    }
    return flat(await questAnswerBlocks(this.answerWire(), accountId, leftover.mutation));
  }

  private async bookList(
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const raw = envelope.form?.["filter_type"];
    const filterType = raw === undefined || raw === "" ? "started" : String(raw);
    if (!filterType) throw new Error("book|quest_list filter_type must be a non-empty string");
    const trio = await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      return this.bookTrio(hero.id, filterType);
    });
    return flat({
      ...trio,
      state: await this.bootstrap.state(accountId),
    });
  }

  private async cancel(
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const fields = { ...(envelope.form ?? {}), ...(envelope.root ?? {}) };
    await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      await this.quests.cancel(
        hero.id,
        requireInt(fields["book_id"] ?? fields["quest_id"], "book_id"),
      );
    });
    return flat({
      "book|quest_cancel": { status: 100 },
      ...(await this.bookTrio(hero.id, "started")),
      state: await this.bootstrap.state(accountId),
    });
  }

  private async hideJournal(
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const fields = { ...(envelope.form ?? {}), ...(envelope.root ?? {}) };
    await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      await this.quests.hideJournal(hero.id, questDeleteId(fields["quest_id"]));
    });
    return flat({
      "book|quest_delete": { status: 100 },
      ...(await this.bookTrio(hero.id, "started")),
    });
  }

  private async applyEffects(
    accountId: number,
    heroId: number,
    mutation: QuestMutation,
  ): Promise<QuestMutation> {
    for (const effect of effectsWithoutLeftover(mutation.effects)) {
      await applyQuestScriptEffect(this.scriptDeps(), accountId, heroId, effect, mutation);
    }
    await this.syncBagGoals(accountId, heroId);
    return { ...mutation, effects: leftoverQuestEffects(mutation.effects) };
  }

  private answerWire(): QuestAnswerWireDeps {
    return {
      quests: this.quests,
      characters: this.characters,
      inventory: this.inventory,
      catalog: this.catalog,
      world: this.world,
      combat: this.combat,
      chat: this.chat,
      fightWire: this.fightWire,
      bootstrap: this.bootstrap,
      random: this.random,
      bookTrio: (heroId, filterType) => this.bookTrio(heroId, filterType),
    };
  }

  private areaDeps(): QuestAreaOaDeps {
    return {
      ...this.answerWire(),
      unitOfWork: this.unitOfWork,
      applyEffects: (accountId, heroId, mutation) => this.applyEffects(accountId, heroId, mutation),
      requireHero: (accountId) => this.requireHero(accountId),
    };
  }

  private async signalBook(heroId: number, signal: QuestSignal): Promise<BookTrioBlocks | null> {
    const mutation = await this.unitOfWork.run(async () => {
      await this.characters.lockById(heroId);
      const result = await this.quests.recordSignal(heroId, signal);
      await this.syncBagGoals(0, heroId);
      return result;
    });
    if (!mutation.bookDirty) return null;
    return this.bookTrio(heroId, "started");
  }

  private async syncBagGoals(accountId: number, heroId: number): Promise<void> {
    const items = await this.inventory.list(heroId);
    const counts = new Map<number, number>();
    for (const item of items) {
      if (item.location.kind === "pocket" || item.location.kind === "tempeffect") continue;
      counts.set(item.artifactId, (counts.get(item.artifactId) ?? 0) + item.quantity);
    }
    const synced = await this.quests.syncOwned(heroId, counts);
    if (accountId > 0 && synced.effects.length > 0) {
      await this.applyEffects(accountId, heroId, synced);
    }
  }

  private async requireHero(accountId: number) {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }

  private scriptDeps() {
    return {
      quests: this.quests,
      characters: this.characters,
      inventory: this.inventory,
      combat: this.combat,
      chat: this.chat,
    };
  }
}

function questDeleteId(raw: unknown): number {
  if (raw === undefined || raw === null) throw new QuestDeniedError("нет квеста");
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new QuestDeniedError("нет квеста");
  return value;
}
