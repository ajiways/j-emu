import type { AssistantTypeDefinition } from "../../catalog/domain/assistant-type-definition.ts";
import type { HeroAssistant } from "./hero-assistant.ts";
import { STARTER_MASTERY, staminaForWire } from "./farm-formulas.ts";

export function assistantToWire(
  row: HeroAssistant,
  type: AssistantTypeDefinition,
  nowSec: number,
  area: Readonly<{ id: number; title: string; picture: string }>,
): object {
  const energy = staminaForWire(row.stamina, row.staminaResetTime, nowSec);
  return {
    id: row.id,
    nick: row.nick || type.title,
    artikul_id: row.artikulId,
    profession: String(type.profession),
    farm_id: row.farmId,
    area_id: area.id,
    area,
    ftime: row.ftime,
    stime: row.stime,
    stamina: energy.stamina,
    stamina_reset_time: energy.resetRemaining,
    flags: row.flags,
    skill_defence: row.skillDefence,
    skill_intellect: row.skillIntellect,
    skill_speed: row.skillSpeed,
    tactics: row.tactics,
    next_artikul_id: type.nextArtikulId,
    mastery_value: Math.max(STARTER_MASTERY, row.masteryValue),
    picture: type.picture,
    level: type.level,
    rank: type.quality,
    result_type: row.resultType,
    result_value: row.resultValue,
    is_voodoo: type.profession === 0,
  };
}

export function farmInfoNode(
  farm: Readonly<{
    id: number;
    title: string;
    typeId: number;
    picture: string;
    swf: string;
    farmTime: number;
    quality: number;
    profession: number;
    artifactArtikulId: number;
    masteryValue: number;
    masteryMax: number;
  }>,
  amount: number,
  maxAmount: number,
): object {
  return {
    id: farm.id,
    title: farm.title,
    type_id: farm.typeId,
    picture: farm.picture,
    swf: farm.swf,
    farm_time: farm.farmTime,
    quality: farm.quality,
    profession: farm.profession,
    artifact_artikul_id: farm.artifactArtikulId,
    flags: 0,
    max_amount: maxAmount,
    amount,
    mastery_value: farm.masteryValue,
    mastery_max: farm.masteryMax,
  };
}
