export type QuestSignal =
  | Readonly<{ kind: "talk"; npcId: number }>
  | Readonly<{ kind: "kill"; artikulId: number }>
  | Readonly<{ kind: "loot"; artikulId: number; count: number }>
  | Readonly<{ kind: "buy"; artikulId: number }>
  | Readonly<{ kind: "equip"; artikulId: number }>
  | Readonly<{ kind: "deliver"; artikulId: number; count: number }>
  | Readonly<{ kind: "area_action"; actionId: number }>
  | Readonly<{ kind: "win_fight" }>;
