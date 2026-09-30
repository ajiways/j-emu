import type { CombatLoadout } from "./combat-loadout.ts";
import type { FightEffectSnap } from "./standing-effect.ts";
import type { FighterAppearance, HumanSnap } from "./human-fighter.ts";

export type ExtraHit = Readonly<{
  hpChange: number;
  dmgType: number;
  react: number;
  killed: boolean;
}>;

export type BotSnap = Readonly<{
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
  dealtDamage: number;
}>;

export type BattleEvent =
  | Readonly<{
      type: "hunt-bootstrap";
      waiting: boolean;
      pvp: boolean;
      resumePaired?: true;
      hero: HumanSnap;
      allies: readonly HumanSnap[];
      bot: BotSnap;
      humanOpponent?: HumanSnap;
      humanOpponentAppearance?: FighterAppearance;
      rosterBots: readonly BotSnap[];
      cp: number;
      cpHits: readonly number[];
      rage: number;
      aggro: number;
      loadout: CombatLoadout;
      heroEffects: readonly FightEffectSnap[];
      botEffects: readonly FightEffectSnap[];
      otherEffects: readonly Readonly<{
        persId: number;
        effects: readonly FightEffectSnap[];
      }>[];
    }>
  | Readonly<{
      type: "roster-updated";
      humans: readonly HumanSnap[];
      joined: HumanSnap;
      bot?: BotSnap;
      rosterBots?: readonly BotSnap[];
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
      react?: number;
      extraHits?: readonly ExtraHit[];
    }>
  | Readonly<{ type: "turn-granted"; timeoutSeconds: number }>
  | Readonly<{ type: "turn-timeout" }>
  | Readonly<{ type: "turn-wait"; timeoutSeconds: number }>
  | Readonly<{ type: "opponent-new"; bot: BotSnap }>
  | Readonly<{ type: "opponent-wait" }>
  | Readonly<{
      type: "pers-change";
      humans: readonly HumanSnap[];
      bots: readonly BotSnap[];
    }>
  | Readonly<{
      type: "opponent-new-human";
      human: HumanSnap;
      appearance: Readonly<{ avatar: string; body: string; sk: string }>;
    }>
  | Readonly<{
      type: "friendly-bootstrap";
      waiting: boolean;
      hero: HumanSnap;
      allies: readonly HumanSnap[];
      opponent?: HumanSnap;
      opponentAppearance?: Readonly<{ avatar: string; body: string; sk: string }>;
      cp: number;
      cpHits: readonly number[];
      rage: number;
      aggro: number;
      loadout: CombatLoadout;
      heroEffects: readonly FightEffectSnap[];
      otherEffects: readonly Readonly<{
        persId: number;
        effects: readonly FightEffectSnap[];
      }>[];
      opponentEffects?: readonly FightEffectSnap[];
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
      type: "pers-effects";
      persId: number;
      effects: readonly FightEffectSnap[];
    }>
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
      loadout: CombatLoadout;
    }>;
