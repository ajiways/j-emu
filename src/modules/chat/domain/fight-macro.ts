import { macroKeyId } from "../../../shared/kernel/macro-key-id.ts";

export type FightMacroToken = Readonly<{
  key: string;
  token: string;
  macro: Readonly<{
    area_id: number;
    area_title: string;
    fight_id: number;
    fight_title: string;
    key_id: string;
    macro_type: "FIGHT";
  }>;
}>;

export function huntFightTitle(heroNick: string, foeNick: string): string {
  if (!heroNick) throw new Error("Hunt fight title requires the hero nick");
  if (!foeNick) throw new Error("Hunt fight title requires the foe nick");
  return `Нападение ${heroNick} на ${foeNick}`;
}

function areaWireId(areaId: string): number {
  if (!areaId) throw new Error("Area id is required");
  const id = Number(areaId);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`Area id ${areaId} is not a wire integer`);
  }
  return id;
}

export function unknownFightTitle(fightId: string): string {
  if (!fightId) throw new Error("Fight id is required");
  return `бой${fightId}`;
}

export function buildFightMacro(input: {
  fightId: string;
  areaId: string;
  areaTitle: string;
  fightTitle: string;
}): FightMacroToken {
  if (!input.fightId) throw new Error("Fight id is required");
  if (!input.areaTitle) throw new Error(`Area ${input.areaId} title is required`);
  if (!input.fightTitle) throw new Error("Fight title is required");
  const fightId = Number(input.fightId);
  if (!Number.isInteger(fightId) || fightId < 1) {
    throw new Error(`Fight id ${input.fightId} is invalid`);
  }
  const key = macroKeyId("FIGHT", input.fightId);
  return {
    key,
    token: `[[FIGHT ${key}]]`,
    macro: {
      area_id: areaWireId(input.areaId),
      area_title: input.areaTitle,
      fight_id: fightId,
      fight_title: input.fightTitle,
      key_id: key,
      macro_type: "FIGHT",
    },
  };
}
