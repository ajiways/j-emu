import type { CombatPort, FightStart, HuntStartInput } from "../../combat/ports/combat-port.ts";
import { HuntJoinDenied } from "../../combat/domain/hunt-join-denied.ts";
import type { WorldService } from "../../world/domain/world-service.ts";
import { ProtocolError } from "./protocol-error.ts";

export type HuntMapAttackInput = Omit<HuntStartInput, "fightId" | "purpose"> &
  Readonly<{
    spawnId: number;
  }>;

export class HuntMapAttack {
  constructor(
    private readonly world: WorldService,
    private readonly combat: CombatPort,
    private readonly fanout: Readonly<{ wakeArea(areaId: string): Promise<void> }>,
  ) {}

  async execute(input: HuntMapAttackInput): Promise<FightStart> {
    const occupied = this.world.occupiedFightId(input.areaId, input.spawnId);
    if (occupied !== null && (await this.combat.hasFight(occupied))) {
      return this.join(input, occupied);
    }
    if (occupied !== null) {
      await this.world.releaseSpawn({ areaId: input.areaId, spawnId: input.spawnId });
      await this.fanout.wakeArea(input.areaId);
    }
    return this.start(input);
  }

  private async join(input: HuntMapAttackInput, fightId: string): Promise<FightStart> {
    try {
      const fight = await this.combat.joinHunt({
        accountId: input.accountId,
        heroId: input.heroId,
        heroNick: input.heroNick,
        heroLevel: input.heroLevel,
        heroKind: input.heroKind,
        heroHp: input.heroHp,
        heroMaxHp: input.heroMaxHp,
        heroMp: input.heroMp,
        heroMaxMp: input.heroMaxMp,
        heroStrength: input.heroStrength,
        fightId,
        areaId: input.areaId,
        team: 1,
        loadout: input.loadout,
      });
      await this.fanout.wakeArea(input.areaId);
      return fight;
    } catch (error) {
      if (error instanceof HuntJoinDenied) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  private async start(input: HuntMapAttackInput): Promise<FightStart> {
    if ((await this.combat.activeFightId(input.accountId)) !== null) {
      throw new ProtocolError(203, "уже в бою");
    }
    const fightId = await this.combat.nextFightId();
    const acquired = await this.world.tryAcquireSpawn({
      areaId: input.areaId,
      spawnId: input.spawnId,
      fightId,
      ownerAccountId: input.accountId,
    });
    if (!acquired.ok) {
      if (acquired.fightId.length < 1) {
        throw new Error("Busy hunt spawn must include the existing fightId");
      }
      if (await this.combat.hasFight(acquired.fightId)) {
        return this.join(input, acquired.fightId);
      }
      throw new ProtocolError(203, "бой не найден");
    }
    try {
      const fight = await this.combat.startHunt({
        accountId: input.accountId,
        heroId: input.heroId,
        heroNick: input.heroNick,
        heroLevel: input.heroLevel,
        heroKind: input.heroKind,
        heroHp: input.heroHp,
        heroMaxHp: input.heroMaxHp,
        heroMp: input.heroMp,
        heroMaxMp: input.heroMaxMp,
        heroStrength: input.heroStrength,
        fightId,
        botId: input.botId,
        botNick: input.botNick,
        botLevel: input.botLevel,
        botHp: input.botHp,
        botStrength: input.botStrength,
        botAvatar: input.botAvatar,
        botSk: input.botSk,
        botBody: input.botBody,
        arena: input.arena,
        areaId: input.areaId,
        loadout: input.loadout,
        botSpellBook: input.botSpellBook,
        purpose: "hunt",
      });
      await this.fanout.wakeArea(input.areaId);
      return fight;
    } catch (error) {
      await this.world.releaseSpawn({ areaId: input.areaId, spawnId: input.spawnId });
      await this.fanout.wakeArea(input.areaId);
      throw error;
    }
  }
}
