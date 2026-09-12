import type { CombatLoadout } from "./combat-loadout.ts";
import type { FightEffectSnap } from "./hunt-human-fight-effects.ts";
import type { HuntHumanSnap } from "./hunt-human.ts";

export type HuntBotSnap = Readonly<{
  id: number;
  nick: string;
  level: number;
  hp: number;
  maxHp: number;
  artikulId: number;
  avatar: string;
  sk: string;
  body: string;
  team: 1 | 2;
}>;

export type BattleEvent =
  | Readonly<{
      type: "hunt-bootstrap";
      waiting: boolean;
      resumePaired?: true;
      hero: HuntHumanSnap;
      allies: readonly HuntHumanSnap[];
      bot: HuntBotSnap;
      rosterBots: readonly HuntBotSnap[];
      cp: number;
      cpHits: readonly number[];
      rage: number;
      aggro: number;
      loadout: CombatLoadout;
      heroEffects: readonly FightEffectSnap[];
    }>
  | Readonly<{
      type: "roster-updated";
      humans: readonly HuntHumanSnap[];
      bot: HuntBotSnap;
      joined: HuntHumanSnap;
    }>
  | Readonly<{
      type: "damage";
      sourceId: number;
      targetId: number;
      animation: string;
      hpChange: number;
      targetMaxHp: number;
      killed: boolean;
      comboCp?: number;
      dRage?: number;
      dmgType?: number;
    }>
  | Readonly<{ type: "turn-granted"; timeoutSeconds: number }>
  | Readonly<{ type: "turn-wait"; timeoutSeconds: number }>
  | Readonly<{ type: "opponent-new"; bot: HuntBotSnap }>
  | Readonly<{ type: "opponent-wait" }>
  | Readonly<{
      type: "opponent-new-human";
      human: HuntHumanSnap;
      appearance: Readonly<{ avatar: string; body: string; sk: string }>;
    }>
  | Readonly<{
      type: "friendly-bootstrap";
      hero: HuntHumanSnap;
      opponent: HuntHumanSnap;
      opponentAppearance: Readonly<{ avatar: string; body: string; sk: string }>;
      cp: number;
      cpHits: readonly number[];
      rage: number;
      aggro: number;
      loadout: CombatLoadout;
      heroEffects: readonly FightEffectSnap[];
      opponentEffects: readonly FightEffectSnap[];
    }>
  | Readonly<{ type: "finished"; winnerTeam: 1 | 2; fightId: string }>
  | Readonly<{
      type: "effect-use";
      artikulId: number;
      animation: string;
      kind: number;
      groupId?: number;
      flags: string | number;
      img: string;
      title: string;
      persId: number;
      dmgType?: number;
      id?: number;
      sourceId?: number;
      remainTime?: number;
      skills?: Readonly<Record<string, number>>;
    }>
  | Readonly<{ type: "effect-purge"; effectId: number }>
  | Readonly<{
      type: "buff-cast";
      animation: string;
      sourceId: number;
      targetId: number;
      maxHp: number;
    }>
  | Readonly<{ type: "pers-cp"; cp: number }>
  | Readonly<{
      type: "native-count";
      srcId: number;
      count: number;
      title: string;
    }>;
