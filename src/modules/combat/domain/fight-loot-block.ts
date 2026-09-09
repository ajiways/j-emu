export type FightLootItemWire = Readonly<{
  artikul_id: number;
  amount: number;
}>;

export type FightArtikulListWire = Readonly<{
  id: number;
  title: string;
  picture: string;
  type_id: string;
  kind_id: number;
  price: number;
  level_min: number;
  level_max: number;
  flags: number;
  slot_mask: number;
  cnt: 1;
}>;

export type FightLootBlock = Readonly<{
  status: 100;
  fight_id: number;
  experience: number;
  money: string;
  honor: 0;
  revenge: 0;
  loot: Readonly<Record<string, FightLootItemWire>> | [];
  artikul_list: Readonly<Record<string, FightArtikulListWire>> | [];
}>;

export function fightLootBlock(input: {
  fightId: string;
  experience: number;
  money: string;
  items: readonly FightLootItemWire[];
  artikulList: readonly FightArtikulListWire[];
}): FightLootBlock {
  const fightId = Number(input.fightId);
  if (!Number.isInteger(fightId) || fightId < 1) {
    throw new Error(`Fight loot fight_id ${input.fightId} is invalid`);
  }
  if (!Number.isInteger(input.experience) || input.experience < 0) {
    throw new Error("Fight loot experience is invalid");
  }
  if (input.items.length !== input.artikulList.length) {
    throw new Error("Fight loot items and artikul_list must match");
  }
  if (input.items.length === 0) {
    return {
      status: 100,
      fight_id: fightId,
      experience: input.experience,
      money: input.money,
      honor: 0,
      revenge: 0,
      loot: [],
      artikul_list: [],
    };
  }
  const loot: Record<string, FightLootItemWire> = {};
  const artikul_list: Record<string, FightArtikulListWire> = {};
  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    const entry = input.artikulList[index];
    if (!item || !entry) throw new Error("Fight loot item is missing");
    if (item.artikul_id !== entry.id) {
      throw new Error("Fight loot artikul_list id does not match loot");
    }
    const key = String(item.artikul_id);
    loot[key] = item;
    artikul_list[key] = entry;
  }
  return {
    status: 100,
    fight_id: fightId,
    experience: input.experience,
    money: input.money,
    honor: 0,
    revenge: 0,
    loot,
    artikul_list,
  };
}
