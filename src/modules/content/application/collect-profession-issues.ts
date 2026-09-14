import { professionInfoFromDocuments } from "../../catalog/domain/profession-info-wire.ts";
import {
  PROFESSION_TYPE_CRAFT,
  PROFESSION_TYPE_GATHER,
  SLICE_CRAFT_PROFESSION_ID,
  SLICE_GATHER_PROFESSION_ID,
} from "../../catalog/domain/profession-ids.ts";
import type { CommonConfBlock } from "../domain/bootstrap-content.ts";
import type { ContentBundle } from "../domain/content-document.ts";
import type { ProfessionDocument } from "../domain/content-profession.ts";

const GATHER_TITLE = "Cтаратель";
const CRAFT_TITLE = "Знаковед";
const GATHER_SKILL = "PR_GEOLOGY";
const CRAFT_SKILL = "PR_JEWELRY";

export function collectProfessionIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const seen = new Set<number>();
  for (const row of bundle.professions) {
    if (seen.has(row.id)) issues.push(`duplicate profession id ${row.id}`);
    seen.add(row.id);
  }
  const gather = bundle.professions.find((row) => row.id === SLICE_GATHER_PROFESSION_ID);
  const craft = bundle.professions.find((row) => row.id === SLICE_CRAFT_PROFESSION_ID);
  if (!gather) {
    issues.push(`profession ${SLICE_GATHER_PROFESSION_ID} is required`);
  } else {
    pushDumpIssues(issues, gather, {
      type: PROFESSION_TYPE_GATHER,
      title: GATHER_TITLE,
      skillId: GATHER_SKILL,
      picture: "geology.png",
      position: 2,
    });
  }
  if (!craft) {
    issues.push(`profession ${SLICE_CRAFT_PROFESSION_ID} is required`);
  } else {
    pushDumpIssues(issues, craft, {
      type: PROFESSION_TYPE_CRAFT,
      title: CRAFT_TITLE,
      skillId: CRAFT_SKILL,
      picture: "jewelry.png",
      position: 5,
    });
  }
  return issues;
}

export function overlayProfessionInfo(bundle: ContentBundle): CommonConfBlock {
  return {
    ...bundle.commonConf,
    profession_info: professionInfoFromDocuments(bundle.professions),
  };
}

function pushDumpIssues(
  issues: string[],
  row: ProfessionDocument,
  expected: Readonly<{
    type: 1 | 2;
    title: string;
    skillId: string;
    picture: string;
    position: number;
  }>,
): void {
  if (row.type !== expected.type) {
    issues.push(`profession ${row.id} type must be ${expected.type}`);
  }
  if (row.title !== expected.title) {
    issues.push(`profession ${row.id} title must be ${expected.title}`);
  }
  if (row.skillId !== expected.skillId) {
    issues.push(`profession ${row.id} skillId must be ${expected.skillId}`);
  }
  if (row.picture !== expected.picture) {
    issues.push(`profession ${row.id} picture must be ${expected.picture}`);
  }
  if (row.position !== expected.position) {
    issues.push(`profession ${row.id} position must be ${expected.position}`);
  }
  if (row.skillStepOverride !== null || row.skillMinlvlOverride !== null) {
    issues.push(`profession ${row.id} skill overrides must be null`);
  }
  if (row.userStatId !== null) {
    issues.push(`profession ${row.id} userStatId must be null`);
  }
}
