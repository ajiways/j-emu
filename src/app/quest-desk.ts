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
import type { QuestMutation, QuestService } from "../modules/quests/application/quest-service.ts";
import { QuestDeniedError } from "../modules/quests/domain/quest-denied-error.ts";
import type { QuestScriptEffect } from "../modules/quests/domain/quest-script-effect.ts";
import type { QuestSignal } from "../modules/quests/domain/quest-signal.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { piggybackQuestFight } from "./quest-fight-piggyback.ts";
import { capDropQuantity } from "../modules/quests/domain/quest-loot-needed.ts";
import {
  answerIdOf,
  npcRefOf,
  questDialogPayload,
  questFlat as flat,
  requireQuestInt as requireInt,
} from "./quest-oa-codec.ts";

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
      if (key === "common|object:AREA") return await this.areaBegin(accountId, envelope);
      if (key === "common|action_finish") return await this.areaFinish(accountId);
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
    return this.boardBlocks(accountId, hero.id, npcId);
  }

  async recordBuy(heroId: number, artikulId: number): Promise<BookTrioBlocks | null> {
    return this.signalBook(heroId, { kind: "buy", artikulId });
  }

  async recordEquip(heroId: number, artikulId: number): Promise<BookTrioBlocks | null> {
    return this.signalBook(heroId, { kind: "equip", artikulId });
  }

  async afterFinished(notice: FightFinishedNotice): Promise<void> {
    if (notice.outcome !== "win") return;
    const hero = await this.characters.getByAccountId(notice.accountId);
    if (!hero) throw new Error(`Hero for account ${notice.accountId} is missing`);
    await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      if (notice.botId) {
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
      await this.characters.lockById(hero.id);
      const mutation = await this.quests.answer(
        hero.id,
        {
          npcRef: npcRefOf(envelope),
          pointId: requireInt(fields["point_id"], "point_id"),
          answerId: answerIdOf(fields["answer_id"]),
        },
        hero.level,
      );
      return this.applyEffects(accountId, hero.id, mutation);
    });
    return flat(await this.answerBlocks(accountId, leftover));
  }

  private async bookList(
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const raw = envelope.form?.["filter_type"];
    const filterType = raw === undefined ? "started" : String(raw);
    if (!filterType) throw new Error("book|quest_list filter_type must be a non-empty string");
    return flat({
      ...(await this.bookTrio(hero.id, filterType)),
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

  private async areaBegin(
    accountId: number,
    envelope: ObjectActionEnvelope,
  ): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const form = envelope.form;
    if (!form) throw new ProtocolError(203, "common|object requires form");
    const actionId = requireInt(form["action_id"], "action_id");
    const mutation = await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      return this.quests.beginAreaAction(
        hero.id,
        requireInt(form["object_id"], "object_id"),
        actionId,
      );
    });
    if (!mutation.waiting) throw new Error("AREA waiting payload is missing");
    return flat({
      "common|action": { status: 100, action: String(actionId) },
      "common|waiting": {
        status: 100,
        title: mutation.waiting.title,
        start: String(mutation.waiting.start),
        finish: String(mutation.waiting.finish),
        action_src: 0,
      },
      state: await this.bootstrap.state(accountId),
    });
  }

  private async areaFinish(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.requireHero(accountId);
    const leftover = await this.unitOfWork.run(async () => {
      await this.characters.lockById(hero.id);
      return this.applyEffects(accountId, hero.id, await this.quests.finishAreaAction(hero.id));
    });
    return flat({
      "common|action_finish": {
        status: 100,
        ...(leftover.popup ? { msg_text: leftover.popup } : {}),
      },
      ...(await this.bookTrio(hero.id, "started")),
      state: await this.bootstrap.state(accountId),
      ...(await piggybackQuestFight(accountId, leftover, {
        characters: this.characters,
        catalog: this.catalog,
        world: this.world,
        inventory: this.inventory,
        combat: this.combat,
        chat: this.chat,
        fightWire: this.fightWire,
      })),
    });
  }

  private async applyEffects(
    accountId: number,
    heroId: number,
    mutation: QuestMutation,
  ): Promise<QuestMutation> {
    const leftover: QuestScriptEffect[] = [];
    for (const effect of mutation.effects) {
      if (effect.type === "START_FIGHT") leftover.push(effect);
      else await this.runEffect(accountId, heroId, effect, mutation.questKey);
    }
    await this.syncBagGoals(accountId, heroId);
    return { ...mutation, effects: leftover };
  }

  private async runEffect(
    accountId: number,
    heroId: number,
    effect: QuestScriptEffect,
    questKey: string | undefined,
  ): Promise<void> {
    if (effect.type === "GRANT_ARTIKUL") {
      const have = await this.inventory.countBagByArtifact({
        characterId: heroId,
        artifactId: effect.artikulId,
      });
      const quantity = capDropQuantity(
        effect.count,
        await this.quests.needed(heroId, effect.artikulId, have),
      );
      if (quantity < 1) return;
      await this.inventory.grantToBag({
        characterId: heroId,
        artifactId: effect.artikulId,
        quantity,
      });
      return;
    }
    if (effect.type === "REMOVE_ARTIKUL") {
      const have = await this.inventory.countBagByArtifact({
        characterId: heroId,
        artifactId: effect.artikulId,
      });
      if (have < 1) return;
      await this.inventory.consumeFromBag({
        characterId: heroId,
        artifactId: effect.artikulId,
        quantity: Math.min(have, effect.count),
      });
      return;
    }
    if (effect.type === "GRANT_PROFESSION") {
      await this.characters.learnProfession({
        characterId: heroId,
        professionId: effect.professionId,
      });
      return;
    }
    if (effect.type === "MSG") {
      await this.chat.deliverSystem(accountId, effect.text);
      return;
    }
    if (effect.type === "SET_FLAG") {
      await this.quests.setFlag(heroId, effect.flag, effect.value);
      return;
    }
    if (effect.type === "CLEAR_FLAG") {
      await this.quests.clearFlag(heroId, effect.flag);
      return;
    }
    if (effect.type === "GRANT_AWARDS") {
      if (!questKey) throw new Error("GRANT_AWARDS requires a quest key");
      const quest = await this.quests.authoredQuest(questKey);
      if (quest.awardExp > 0) {
        await this.characters.grantExperience({
          characterId: heroId,
          operationId: `quest:${heroId}:${quest.key}:exp`,
          amount: quest.awardExp,
        });
      }
      if (quest.awardMoneyMinor > 0) {
        await this.characters.creditMoney({
          characterId: heroId,
          minorUnits: quest.awardMoneyMinor,
        });
      }
      for (const item of quest.awardItems) {
        await this.inventory.grantToBag({
          characterId: heroId,
          artifactId: item.artikulId,
          quantity: item.count,
        });
      }
      return;
    }
    throw new Error(`Quest script ${effect.type} is not executable in this slice`);
  }

  private async answerBlocks(
    accountId: number,
    mutation: QuestMutation,
  ): Promise<Record<string, unknown>> {
    const hero = await this.requireHero(accountId);
    const blocks: Record<string, unknown> = {
      "npc|answer": { status: 100 },
      ...(await this.boardBlocks(accountId, hero.id, mutation.npcId)),
    };
    if (mutation.dialog && mutation.pointId) {
      blocks["npc|answer"] = questDialogPayload(
        mutation.pointId,
        mutation.dialog,
        await this.quests.npcInfo(mutation.npcId),
      );
    }
    const fight = await piggybackQuestFight(accountId, mutation, {
      characters: this.characters,
      catalog: this.catalog,
      world: this.world,
      inventory: this.inventory,
      combat: this.combat,
      chat: this.chat,
      fightWire: this.fightWire,
    });
    return { ...blocks, ...fight };
  }

  private async boardBlocks(
    accountId: number,
    heroId: number,
    npcId: number,
  ): Promise<Record<string, unknown>> {
    return {
      "npc|quests": await this.quests.boardRows(heroId, npcId),
      "npc|info": await this.quests.npcInfo(npcId),
      ...(await this.bookTrio(heroId, "started")),
      state: await this.bootstrap.state(accountId),
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
}
