import type { BattleEvent } from "../domain/battle-event.ts";
import type { CombatLoadout } from "../domain/combat-loadout.ts";
import type { HuntBotSpellBook } from "../domain/hunt-bot-spell-book.ts";
import type { FightInfoCard } from "../domain/fight-info-card.ts";
import type { FightResultInfo } from "../domain/fight-result-info.ts";
import type { FightLootBlock } from "../domain/fight-loot-block.ts";
import type { FinishedFightListQuery, FinishedFightPage } from "../domain/finished-fight-page.ts";
import type { HuntHumanAppearance } from "../domain/hunt-human.ts";
import type { RunnedFightPage } from "../domain/runned-fight-record.ts";

type CommandSequence = string | number;

export type FightCommand =
  | Readonly<{ kind: "authenticate"; fightId: string; sequence: CommandSequence }>
  | Readonly<{
      kind: "strike";
      side: "left" | "center" | "right";
      sequence: CommandSequence;
    }>
  | Readonly<{ kind: "pocket"; itemId: number; sequence: CommandSequence }>
  | Readonly<{ kind: "glove"; spellId: number; sequence: CommandSequence }>
  | Readonly<{ kind: "rage"; sequence: CommandSequence }>
  | Readonly<{ kind: "aggro"; sequence: CommandSequence }>
  | Readonly<{ kind: "leave"; sequence: CommandSequence }>
  | Readonly<{ kind: "pers-info"; sequence: CommandSequence }>
  | Readonly<{ kind: "pers-effects"; persId: number; sequence: CommandSequence }>
  | Readonly<{ kind: "poll" }>;

export type FightStart = Readonly<{
  fightId: string;
  accessKey: string;
  participantId: number;
  arena: string;
  purpose: "hunt" | "quest" | "friendly-duel" | "pvp";
  instanceCopyId: number | null;
  fightFlags: string | null;
}>;

export type HuntStartInput = Readonly<{
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroHp: number;
  heroMaxHp: number;
  heroMp: number;
  heroMaxMp: number;
  heroStrength: number;
  heroInitiative: number;
  heroRage: number;
  heroDexterity: number;
  heroDefense: number;
  heroBlock: number;
  heroAggroCharges: number;
  heroMagPower: number;
  heroMagResist: number;
  fightId: string;
  botId: number;
  botNick: string;
  botLevel: number;
  botHp: number;
  botStrength: number;
  botInitiative: number;
  botMagPower: number;
  botMagResist: number;
  botAvatar: string;
  botSk: string;
  botBody: string;
  arena: string;
  areaId: string;
  instanceCopyId: number | null;
  appearance: HuntHumanAppearance;
  loadout: CombatLoadout;
  botSpellBook: HuntBotSpellBook;
  purpose: "hunt" | "quest";
  extraEnemies: readonly HuntRosterBotInput[];
  allies: readonly HuntRosterBotInput[];
  chatWin: string;
  chatLose: string;
}>;

export type HuntRosterBotInput = Readonly<{
  artikulId: number;
  nick: string;
  level: number;
  hp: number;
  strength: number;
  initiative: number;
  magPower: number;
  magResist: number;
  avatar: string;
  sk: string;
  body: string;
  spellBook: HuntBotSpellBook;
}>;

export type HuntJoinInput = Readonly<{
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroHp: number;
  heroMaxHp: number;
  heroMp: number;
  heroMaxMp: number;
  heroStrength: number;
  heroInitiative: number;
  heroRage: number;
  heroDexterity: number;
  heroDefense: number;
  heroBlock: number;
  heroAggroCharges: number;
  heroMagPower: number;
  heroMagResist: number;
  fightId: string;
  areaId: string;
  instanceCopyId: number | null;
  team: 1 | 2;
  appearance: HuntHumanAppearance;
  loadout: CombatLoadout;
}>;

export type CombatEvent =
  | BattleEvent
  | Readonly<{ type: "command-accepted"; sequence: CommandSequence; accessKey?: string }>
  | Readonly<{ type: "command-denied"; sequence: CommandSequence; err: string }>;

export type FightExit = Readonly<{
  fightId: string;
  winnerTeam: 1 | 2;
  flee?: true;
}>;

export type FriendlyDuelStartInput = Readonly<{
  challenger: FriendlyDuelFighterInput;
  acceptor: FriendlyDuelFighterInput;
  fightId: string;
  arena: string;
  areaId: string;
  instanceCopyId: number | null;
  fightFlags: string | null;
}>;

type FriendlyDuelFighterInput = Readonly<{
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroHp: number;
  heroMaxHp: number;
  heroMp: number;
  heroMaxMp: number;
  heroStrength: number;
  heroInitiative: number;
  heroRage: number;
  heroDexterity: number;
  heroDefense: number;
  heroBlock: number;
  heroAggroCharges: number;
  heroMagPower: number;
  heroMagResist: number;
  loadout: CombatLoadout;
  avatar: string;
  body: string;
  sk: string;
}>;

export interface CombatPort {
  nextFightId(): Promise<string>;
  startHunt(input: HuntStartInput): Promise<FightStart>;
  joinHunt(input: HuntJoinInput): Promise<FightStart>;
  startFriendlyDuel(input: FriendlyDuelStartInput): Promise<FightStart>;
  startPvp(input: FriendlyDuelStartInput): Promise<FightStart>;
  hasFight(fightId: string): Promise<boolean>;
  participantTeam(accountId: number): Promise<1 | 2 | null>;
  execute(accountId: number, command: FightCommand): Promise<readonly CombatEvent[]>;
  takePocketConsume(accountId: number): number | null;
  activeFightId(accountId: number): Promise<string | null>;
  resumeFight(accountId: number): Promise<FightStart | null>;
  accountForFight(fightId: string): Promise<number | null>;
  takeExit(accountId: number): Promise<FightExit | null>;
  peekExit(accountId: number): Promise<FightExit | null>;
  takeLoot(accountId: number): Promise<FightLootBlock | null>;
  peekLoot(accountId: number): Promise<FightLootBlock | null>;
  listFinishedFights(query: FinishedFightListQuery): Promise<FinishedFightPage>;
  listRunnedFights(query: FinishedFightListQuery): Promise<RunnedFightPage>;
  fightInfo(fightId: string): Promise<FightInfoCard | null>;
  lastFightInfo(accountId: number): Promise<FightResultInfo | null>;
}
