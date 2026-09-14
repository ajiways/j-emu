export type BotHuntLook = Readonly<{
  nick: string;
  swf: string;
  scale: number;
  fps: number;
  speed: number;
  avatar: string;
  kind: number;
  hideOnMap: 0 | 1;
  sk: string;
  body: string;
}>;

export type BotSource = Readonly<{
  id: number;
  title: string;
  level: number;
  maxHp: number;
  strength: number;
  sk: string;
  avatar: string;
  body: string;
  kind: number;
  ultrabeast: number;
  baseExp: number;
  moneyMin: number;
  moneyMax: number;
  dropIds: readonly number[];
  hunt: BotHuntLook;
  provenance: "amf" | "gap-fill";
}>;
