import type { CharacterService } from "../../character/application/character-service.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";

export async function withSyncedResources<T>(
  unitOfWork: UnitOfWork,
  characters: CharacterService,
  accountId: number,
  read: () => Promise<T>,
): Promise<T> {
  return unitOfWork.run(async () => {
    const hero = await characters.lockByAccountId(accountId);
    await characters.syncResources({ characterId: hero.id });
    return read();
  });
}
