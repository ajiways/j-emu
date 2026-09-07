import fs from "node:fs";

export type CommonConfBlock = Readonly<{
  status: 100;
  gag_reason_info: unknown;
  kind_info: unknown;
  rank_info: unknown;
  money_info: unknown;
  loot_type_info: unknown;
  quality_info: unknown;
  fight_level_info: unknown;
  great_fight_k1: unknown;
  great_fight_k2: unknown;
  profession_info: unknown;
  assistant_tactics_info: unknown;
  SEAL_PERCENT_COMMON: unknown;
  skill_groups: unknown;
  level_table: unknown;
  rank_table: unknown;
  restriction_modules: unknown;
  HAPPY_BIRTHDAY_DESCRIPTION: unknown;
  HAPPY_BIRTHDAY_IMAGE: unknown;
  HAPPY_BIRTHDAY_PAYMENT_PERCENT: unknown;
  macros_list: unknown;
}>;

export class CommonConfDocument {
  static readonly requiredKeys: readonly (keyof CommonConfBlock)[] = [
    "status",
    "gag_reason_info",
    "kind_info",
    "rank_info",
    "money_info",
    "loot_type_info",
    "quality_info",
    "fight_level_info",
    "great_fight_k1",
    "great_fight_k2",
    "profession_info",
    "assistant_tactics_info",
    "SEAL_PERCENT_COMMON",
    "skill_groups",
    "level_table",
    "rank_table",
    "restriction_modules",
    "HAPPY_BIRTHDAY_DESCRIPTION",
    "HAPPY_BIRTHDAY_IMAGE",
    "HAPPY_BIRTHDAY_PAYMENT_PERCENT",
    "macros_list",
  ];

  static load(filePath: string): CommonConfBlock {
    if (!filePath) throw new Error("Common conf file path is required");
    if (!fs.existsSync(filePath)) {
      throw new Error(`Common conf file does not exist: ${filePath}`);
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      throw new Error(`Common conf is not valid JSON: ${filePath}`, { cause: error });
    }
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error(`Common conf must be a JSON object: ${filePath}`);
    }
    const record = decoded as Record<string, unknown>;
    const missing = CommonConfDocument.requiredKeys.filter((key) => !(key in record));
    if (missing.length > 0) {
      throw new Error(`Common conf is missing keys ${missing.join(", ")}: ${filePath}`);
    }
    if (record["status"] !== 100) {
      throw new Error(`Common conf status must be 100: ${filePath}`);
    }
    return record as CommonConfBlock;
  }
}
