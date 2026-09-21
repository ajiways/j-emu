import type { HuntBotSnap } from "./battle-event.ts";
import type { FightTeamAssignment } from "./fight-rules.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import { HuntRosterBot, type HuntRosterBotSeed } from "./hunt-roster-bot.ts";

export class HuntRoster {
  readonly openerTeam: 1 | 2;
  readonly enemyTeam: 1 | 2;
  readonly primary: HuntRosterBot;
  private readonly bots: HuntRosterBot[];

  constructor(
    input: Readonly<{
      primary: HuntRosterBotSeed;
      extraEnemies: readonly HuntRosterBotSeed[];
      allies: readonly HuntRosterBotSeed[];
      occupiedIds: readonly number[];
      effectIds: FightEffectIds;
      teamAssignment: FightTeamAssignment;
    }>,
  ) {
    this.openerTeam = input.teamAssignment.openerTeam;
    this.enemyTeam = input.teamAssignment.enemyTeam;
    this.primary = HuntRosterBot.fromSeed(input.primary, this.enemyTeam, input.effectIds);
    const extraEnemies = input.extraEnemies.map((seed) =>
      HuntRosterBot.fromSeed(seed, this.enemyTeam, input.effectIds),
    );
    const allies = input.allies.map((seed) =>
      HuntRosterBot.fromSeed(seed, this.openerTeam, input.effectIds),
    );
    this.bots = [this.primary, ...extraEnemies, ...allies];
    const seen = new Set<number>(input.occupiedIds);
    for (const bot of this.bots) {
      if (seen.has(bot.fightId)) {
        throw new Error(`Roster bot fight id ${bot.fightId} collides`);
      }
      seen.add(bot.fightId);
    }
    for (const bot of extraEnemies) bot.unpair();
    for (const bot of allies) bot.unpair();
  }

  snaps(): readonly HuntBotSnap[] {
    return this.bots.map((bot) => bot.snap());
  }

  allBots(): readonly HuntRosterBot[] {
    return this.bots;
  }

  enemySideCleared(): boolean {
    return this.bots.filter((bot) => bot.team === this.enemyTeam).every((bot) => bot.hp === 0);
  }

  bot(fightId: number): HuntRosterBot {
    return this.requireBot(fightId);
  }

  findBot(fightId: number): HuntRosterBot | null {
    return this.bots.find((entry) => entry.fightId === fightId) ?? null;
  }

  enqueueAggroClone(sourceFightId: number, cloneFightId: number): HuntRosterBot {
    const source = this.requireBot(sourceFightId);
    if (source.team !== this.enemyTeam) {
      throw new Error("Aggro clone source must be an enemy bot");
    }
    const clone = source.cloneWithFightId(cloneFightId);
    if (this.bots.some((bot) => bot.fightId === clone.fightId)) {
      throw new Error(`Roster bot fight id ${clone.fightId} collides`);
    }
    this.bots.push(clone);
    clone.unpair();
    return clone;
  }

  private requireBot(fightId: number): HuntRosterBot {
    const bot = this.bots.find((entry) => entry.fightId === fightId);
    if (!bot) throw new Error(`Roster bot ${fightId} is missing`);
    return bot;
  }
}
