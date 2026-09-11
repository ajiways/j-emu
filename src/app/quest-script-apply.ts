import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { QuestMutation } from "../modules/quests/application/quest-mutation.ts";
import type { QuestService } from "../modules/quests/application/quest-service.ts";
import { capDropQuantity } from "../modules/quests/domain/quest-loot-needed.ts";
import type { QuestScriptEffect } from "../modules/quests/domain/quest-script-effect.ts";
import type { ChatDesk } from "./chat-desk.ts";

export async function applyQuestScriptEffect(
  deps: Readonly<{
    quests: QuestService;
    characters: CharacterService;
    inventory: InventoryService;
    chat: ChatDesk;
  }>,
  accountId: number,
  heroId: number,
  effect: QuestScriptEffect,
  mutation: QuestMutation,
): Promise<void> {
  if (effect.type === "GRANT_ARTIKUL") {
    const have = await deps.inventory.countBagByArtifact({
      characterId: heroId,
      artifactId: effect.artikulId,
    });
    const quantity = capDropQuantity(
      effect.count,
      await deps.quests.needed(heroId, effect.artikulId, have),
    );
    if (quantity < 1) return;
    await deps.inventory.grantToBag({
      characterId: heroId,
      artifactId: effect.artikulId,
      quantity,
    });
    return;
  }
  if (effect.type === "REMOVE_ARTIKUL") {
    const have = await deps.inventory.countBagByArtifact({
      characterId: heroId,
      artifactId: effect.artikulId,
    });
    if (have < 1) return;
    await deps.inventory.consumeFromBag({
      characterId: heroId,
      artifactId: effect.artikulId,
      quantity: Math.min(have, effect.count),
    });
    return;
  }
  if (effect.type === "GRANT_PROFESSION") {
    await deps.characters.learnProfession({
      characterId: heroId,
      professionId: effect.professionId,
    });
    return;
  }
  if (effect.type === "MSG") {
    await deps.chat.deliverSystem(accountId, effect.text);
    return;
  }
  if (effect.type === "SET_FLAG") {
    await deps.quests.setFlag(heroId, effect.flag, effect.value);
    return;
  }
  if (effect.type === "CLEAR_FLAG") {
    await deps.quests.clearFlag(heroId, effect.flag);
    return;
  }
  if (effect.type === "GRANT_AWARDS") {
    if (!mutation.questKey) throw new Error("GRANT_AWARDS requires a quest key");
    const quest = await deps.quests.authoredQuest(mutation.questKey);
    if (quest.awardExp > 0) {
      const grant = mutation.experienceGrant;
      if (!grant) throw new Error("GRANT_AWARDS experience grant is missing");
      if (grant.amount !== quest.awardExp) {
        throw new Error("GRANT_AWARDS experience amount does not match the quest");
      }
      await deps.characters.grantExperience({
        characterId: heroId,
        operationId: grant.operationId,
        amount: grant.amount,
      });
    }
    if (quest.awardMoneyMinor > 0) {
      await deps.characters.creditMoney({
        characterId: heroId,
        minorUnits: quest.awardMoneyMinor,
      });
    }
    for (const item of quest.awardItems) {
      await deps.inventory.grantToBag({
        characterId: heroId,
        artifactId: item.artikulId,
        quantity: item.count,
      });
    }
    return;
  }
  throw new Error(`Quest script ${effect.type} is not executable in this slice`);
}
