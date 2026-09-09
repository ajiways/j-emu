import type { ContentBundle } from "../domain/content-document.ts";

const REQUIRED_SKILLS = ["INJ_PROB", "BLOK", "BLOK_VISUAL"] as const;

const CRYSTALS = [
  { id: 553, title: "Древний кристалл заточки", param1: 0, param2: 1, actionKey: "152" },
  { id: 1310, title: "Обычный кристалл заточки", param1: 0, param2: 2, actionKey: "467" },
  { id: 4603, title: "Ледяной кристалл заточки", param1: 0, param2: 3, actionKey: "1888" },
  { id: 11408, title: "Волшебный резонатор заточки", param1: 3, param2: 2, actionKey: "5703" },
  { id: 13224, title: "Адамантовый кристалл заточки", param1: 0, param2: 4, actionKey: "6963" },
] as const;

export function collectUpgradeIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const skillIds = new Set(bundle.skills.map((skill) => skill.id));
  for (const skillId of REQUIRED_SKILLS) {
    if (!skillIds.has(skillId)) issues.push(`missing required upgrade skill ${skillId}`);
  }
  for (const spec of CRYSTALS) {
    const artifact = bundle.artifacts.find((row) => row.id === spec.id);
    if (!artifact) {
      issues.push(`upgrade crystal ${spec.id} is missing`);
      continue;
    }
    if (artifact.title !== spec.title) {
      issues.push(`upgrade crystal ${spec.id} title must be ${spec.title}`);
    }
    if (artifact.typeId !== "73") issues.push(`upgrade crystal ${spec.id} typeId must be 73`);
    if (artifact.kindId !== 12) issues.push(`upgrade crystal ${spec.id} kindId must be 12`);
    const action = artifact.artifact_actions[spec.actionKey];
    if (!action) {
      issues.push(`upgrade crystal ${spec.id} is missing action ${spec.actionKey}`);
      continue;
    }
    if (action.code !== "ARTIFACT_UPGRADE") {
      issues.push(`upgrade crystal ${spec.id} action must be ARTIFACT_UPGRADE`);
    }
    if (action.param1 !== spec.param1) {
      issues.push(`upgrade crystal ${spec.id} param1 must be ${spec.param1}`);
    }
    if (action.param2 !== spec.param2) {
      issues.push(`upgrade crystal ${spec.id} param2 must be ${spec.param2}`);
    }
  }
  return issues;
}
