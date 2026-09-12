import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../modules/world/domain/world-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { FightWireMapper } from "../modules/jugger-wire/application/fight-wire-mapper.ts";
import type { BootstrapReadModel } from "../modules/jugger-wire/application/bootstrap-read-model.ts";
import { ProtocolError } from "../modules/jugger-wire/application/protocol-error.ts";
import type { OaEncodedResponse } from "../modules/jugger-wire/commands/oa/oa-command.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";
import type { QuestMutation } from "../modules/quests/application/quest-mutation.ts";
import type { QuestService } from "../modules/quests/application/quest-service.ts";
import type { BookTrioBlocks } from "../modules/jugger-wire/application/book-quest-blocks.ts";
import type { ChatDesk } from "./chat-desk.ts";
import { piggybackQuestFight } from "./quest-fight-piggyback.ts";
import { questFlat as flat, requireQuestInt as requireInt } from "./quest-oa-codec.ts";

export type QuestAreaOaDeps = Readonly<{
  quests: QuestService;
  characters: CharacterService;
  inventory: InventoryService;
  catalog: Catalog;
  world: WorldService;
  combat: CombatPort;
  chat: ChatDesk;
  unitOfWork: UnitOfWork;
  fightWire: FightWireMapper;
  bootstrap: BootstrapReadModel;
  random: Readonly<{ unit(): number }>;
  bookTrio: (heroId: number, filterType: string) => Promise<BookTrioBlocks>;
  applyEffects: (
    accountId: number,
    heroId: number,
    mutation: QuestMutation,
  ) => Promise<QuestMutation>;
  requireHero: (accountId: number) => Promise<{ id: number }>;
}>;

export async function questAreaBegin(
  deps: QuestAreaOaDeps,
  accountId: number,
  envelope: ObjectActionEnvelope,
): Promise<OaEncodedResponse> {
  const hero = await deps.requireHero(accountId);
  const form = envelope.form;
  if (!form) throw new ProtocolError(203, "common|object requires form");
  const actionId = requireInt(form["action_id"], "action_id");
  const mutation = await deps.unitOfWork.run(async () => {
    await deps.characters.lockById(hero.id);
    return deps.quests.beginAreaAction(
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
    state: await deps.bootstrap.state(accountId),
  });
}

export async function questAreaFinish(
  deps: QuestAreaOaDeps,
  accountId: number,
): Promise<OaEncodedResponse> {
  const hero = await deps.requireHero(accountId);
  const leftover = await deps.unitOfWork.run(async () => {
    await deps.characters.lockById(hero.id);
    return deps.applyEffects(accountId, hero.id, await deps.quests.finishAreaAction(hero.id));
  });
  return flat({
    "common|action_finish": {
      status: 100,
      ...(leftover.popup ? { msg_text: leftover.popup } : {}),
    },
    ...(await deps.bookTrio(hero.id, "started")),
    state: await deps.bootstrap.state(accountId),
    ...(await piggybackQuestFight(accountId, leftover, {
      characters: deps.characters,
      catalog: deps.catalog,
      world: deps.world,
      inventory: deps.inventory,
      combat: deps.combat,
      chat: deps.chat,
      fightWire: deps.fightWire,
      random: deps.random,
    })),
  });
}
