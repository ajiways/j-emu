import type { ContentBundle } from "../domain/content-document.ts";

export function collectLevelNoticeIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const artifactIds = new Set(bundle.artifacts.map((artifact) => artifact.id));
  const macros = bundle.commonConf.macros_list;
  const macroKeys = new Set(
    macros !== null && typeof macros === "object" && !Array.isArray(macros)
      ? Object.keys(macros)
      : [],
  );
  for (const level of bundle.levels) {
    const notice = level.notice;
    if (notice === undefined) continue;
    for (const match of notice.body.matchAll(/\[\[([A-Z_]+) ([0-9a-f]{32})\]\]/g)) {
      const key = match[2];
      if (key === undefined || !macroKeys.has(key)) {
        issues.push(
          `level ${level.level} notice macro ${match[1]} ${match[2]} is not in macros_list`,
        );
      }
    }
    if (new Set(notice.artikulIds).size !== notice.artikulIds.length) {
      issues.push(`level ${level.level} notice repeats an artifact`);
    }
    for (const artikulId of notice.artikulIds) {
      if (!artifactIds.has(artikulId)) {
        issues.push(`level ${level.level} notice artifact ${artikulId} is missing`);
      }
    }
  }
  return issues;
}
