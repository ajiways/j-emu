import { PROFESSION_SLOT_COUNT } from "../../catalog/domain/profession-ids.ts";
import { maxProfessionSkillForLevel } from "./profession-cap.ts";

export type ProfessionLicense = Readonly<{
  professionId: number;
  value: number;
}>;

export type UserProfessionSlot =
  | Readonly<{ value: 0 }>
  | Readonly<{
      id: number;
      active: true;
      value: number;
    }>;

export function userProfessionsWire(
  licenses: readonly ProfessionLicense[],
  level: number,
): Readonly<{
  status: 100;
  professions: readonly UserProfessionSlot[];
  max_profession_skill: number;
}> {
  const slots: UserProfessionSlot[] = Array.from({ length: PROFESSION_SLOT_COUNT }, () => ({
    value: 0,
  }));
  for (const row of licenses) {
    if (!Number.isInteger(row.professionId) || row.professionId < 1) {
      throw new Error(`Profession id ${row.professionId} is invalid`);
    }
    if (row.professionId > PROFESSION_SLOT_COUNT) {
      throw new Error(`Profession id ${row.professionId} is outside the wire slots`);
    }
    if (!Number.isInteger(row.value) || row.value < 1) {
      throw new Error(`Profession ${row.professionId} value is missing`);
    }
    slots[row.professionId - 1] = { id: row.professionId, active: true, value: row.value };
  }
  return {
    status: 100,
    professions: slots,
    max_profession_skill: licenses.length === 0 ? 0 : maxProfessionSkillForLevel(level),
  };
}
