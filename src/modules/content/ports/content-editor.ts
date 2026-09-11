import type { PublishedRelease } from "../domain/content-document.ts";
import type { ContentType } from "../domain/parse-content-document.ts";

export type SaveDraftCommand = Readonly<{
  contentType: string;
  contentKey: string;
  document: unknown;
  expectedVersion: number;
}>;

export type SaveDraftResult = Readonly<{
  draftVersionId: string;
  version: number;
}>;

export type CandidateOverlay = Readonly<{
  contentType: string;
  contentKey: string;
  draftVersionId: string;
}>;

export type BuildCandidateCommand = Readonly<{
  overlays: readonly CandidateOverlay[];
  expectedActiveReleaseId: string;
}>;

export type ValidateCandidateResult = Readonly<{
  ok: boolean;
  reportId: string;
}>;

export type ActivateCandidateResult = Readonly<{
  releaseId: string;
  version: number;
}>;

export type ContentReleaseStatus = PublishedRelease;

export interface ContentEditor {
  saveDraft(command: SaveDraftCommand): Promise<SaveDraftResult>;
  buildCandidate(command: BuildCandidateCommand): Promise<{ candidateId: string }>;
  validateCandidate(candidateId: string): Promise<ValidateCandidateResult>;
  activateCandidate(candidateId: string): Promise<ActivateCandidateResult>;
  status(): Promise<ContentReleaseStatus>;
}

export type ContentEditorDraftVersion = Readonly<{
  id: string;
  contentType: ContentType;
  contentKey: string;
  document: unknown;
}>;

export type ContentEditorReleaseEntry = Readonly<{
  contentType: ContentType;
  contentKey: string;
  draftVersionId: string;
}>;

export type ContentEditorCandidate = Readonly<{
  id: string;
  expectedActiveReleaseId: string;
  status: "open" | "validated" | "invalid" | "activated";
}>;

export type ContentEditorValidationReport = Readonly<{
  id: string;
  ok: boolean;
}>;

export type ValidationReportIssues = Readonly<{
  schema: 1;
  issues: ReadonlyArray<Readonly<{ path: string; message: string }>>;
}>;
