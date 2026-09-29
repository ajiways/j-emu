import type { ContentBundle } from "../domain/content-document.ts";

export function collectLevelNoticeIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const artifactIds = new Set(bundle.artifacts.map((artifact) => artifact.id));
  for (const level of bundle.levels) {
    const notice = level.notice;
    if (notice === undefined) continue;
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
