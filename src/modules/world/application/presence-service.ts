import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterPresence, PresenceHero } from "../../character/ports/character-presence.ts";
import type { SessionPresence } from "../../identity/ports/session-presence.ts";
import {
  areaPopulationBlock,
  buildCharacterInfo,
  type AreaPopulationBlock,
  type CharacterInfo,
} from "../domain/character-info.ts";
import type { PresenceNotice } from "../domain/presence-notice.ts";
import type { WorldService } from "../domain/world-service.ts";

export class PresenceService {
  constructor(
    private readonly world: WorldService,
    private readonly sessions: SessionPresence,
    private readonly characters: CharacterPresence,
    private readonly catalog: Catalog,
  ) {}

  async listPopulation(areaId: string): Promise<AreaPopulationBlock> {
    await this.world.area(areaId);
    const infos = await this.infosInArea(areaId);
    return areaPopulationBlock(infos);
  }

  async enterNotices(accountId: number): Promise<PresenceNotice> {
    const hero = await this.characters.requirePresence(accountId);
    await this.world.area(hero.areaId);
    return {
      recipientAccountIds: await this.neighborAccountIds(hero.areaId, accountId),
      add: await this.info(hero),
    };
  }

  async leaveNotices(accountId: number): Promise<PresenceNotice> {
    const hero = await this.characters.requirePresence(accountId);
    await this.world.area(hero.areaId);
    return {
      recipientAccountIds: await this.neighborAccountIds(hero.areaId, accountId),
      removeNick: hero.nick,
    };
  }

  async moveNotices(
    accountId: number,
    fromAreaId: string,
    toAreaId: string,
  ): Promise<readonly PresenceNotice[]> {
    if (!fromAreaId) throw new Error("fromAreaId is required");
    if (!toAreaId) throw new Error("toAreaId is required");
    if (fromAreaId === toAreaId) return [];
    const hero = await this.characters.requirePresence(accountId);
    if (hero.areaId !== toAreaId) {
      throw new Error(`Hero for account ${accountId} is in ${hero.areaId}, not ${toAreaId}`);
    }
    await this.world.area(fromAreaId);
    await this.world.area(toAreaId);
    return [
      {
        recipientAccountIds: await this.neighborAccountIds(fromAreaId, accountId),
        removeNick: hero.nick,
      },
      {
        recipientAccountIds: await this.neighborAccountIds(toAreaId, accountId),
        add: await this.info(hero),
      },
    ];
  }

  private async infosInArea(areaId: string): Promise<readonly CharacterInfo[]> {
    const online = new Set(await this.sessions.listAccountIdsWithSession());
    const infos: CharacterInfo[] = [];
    for (const hero of await this.characters.listInArea(areaId)) {
      if (!online.has(hero.accountId)) continue;
      infos.push(await this.info(hero));
    }
    return infos.sort((left, right) => left.id - right.id);
  }

  private async neighborAccountIds(
    areaId: string,
    exceptAccountId: number,
  ): Promise<readonly number[]> {
    return (await this.infosInArea(areaId))
      .map((info) => info.id)
      .filter((id) => id !== exceptAccountId);
  }

  private async info(hero: PresenceHero): Promise<CharacterInfo> {
    const appearance = await this.catalog.appearance(hero.kind, hero.gender);
    return buildCharacterInfo(hero, appearance.avatarSmall);
  }
}
