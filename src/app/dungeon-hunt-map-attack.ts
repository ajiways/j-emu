import type {
  CombatPort,
  FightStart,
  HuntStartInput,
} from "../modules/combat/ports/combat-port.ts";
import { HuntJoinDenied } from "../modules/combat/domain/hunt-join-denied.ts";
import type { DungeonHuntWorld } from "../modules/instance/application/dungeon-hunt-world.ts";
import { ProtocolError } from "../modules/jugger-wire/application/protocol-error.ts";

export type DungeonHuntAttackInput = Omit<HuntStartInput, "fightId" | "purpose"> &
  Readonly<{
    copyId: number;
    spawnId: number;
  }>;

export class DungeonHuntMapAttack {
  constructor(
    private readonly hunt: DungeonHuntWorld,
    private readonly combat: CombatPort,
    private readonly fanout: Readonly<{
      wakeArea(areaId: string, instanceCopyId: number | null): Promise<void>;
    }>,
  ) {}

  async execute(input: DungeonHuntAttackInput): Promise<FightStart> {
    const occupied = this.hunt.occupiedFightId(input.copyId, input.areaId, input.spawnId);
    if (occupied !== null && (await this.combat.hasFight(occupied))) {
      return this.join(input, occupied);
    }
    if (occupied !== null) {
      this.hunt.release(input.copyId, input.areaId, input.spawnId);
      await this.fanout.wakeArea(input.areaId, input.copyId);
    }
    return this.start(input);
  }

  private async join(input: DungeonHuntAttackInput, fightId: string): Promise<FightStart> {
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
        instanceCopyId: input.copyId,
        team: 1,
        appearance: input.appearance,
        loadout: input.loadout,
      });
      await this.fanout.wakeArea(input.areaId, input.copyId);
      return fight;
    } catch (error) {
      if (error instanceof HuntJoinDenied) throw new ProtocolError(203, error.message);
      throw error;
    }
  }

  private async start(input: DungeonHuntAttackInput): Promise<FightStart> {
    if ((await this.combat.activeFightId(input.accountId)) !== null) {
      throw new ProtocolError(203, "уже в бою");
    }
    const fightId = await this.combat.nextFightId();
    const acquired = await this.hunt.tryAcquire({
      copyId: input.copyId,
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
        instanceCopyId: input.copyId,
        appearance: input.appearance,
        loadout: input.loadout,
        botSpellBook: input.botSpellBook,
        extraEnemies: [],
        allies: [],
        chatWin: "",
        chatLose: "",
        purpose: "hunt",
      });
      await this.fanout.wakeArea(input.areaId, input.copyId);
      return fight;
    } catch (error) {
      this.hunt.release(input.copyId, input.areaId, input.spawnId);
      await this.fanout.wakeArea(input.areaId, input.copyId);
      throw error;
    }
  }
}
