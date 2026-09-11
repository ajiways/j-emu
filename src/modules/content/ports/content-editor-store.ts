import type { PublishedRelease, ValidatedContentBundle } from "../domain/content-document.ts";
import type { ContentType } from "../domain/parse-content-document.ts";
import type {
  ContentEditorCandidate,
  ContentEditorDraftVersion,
  ContentEditorReleaseEntry,
  ContentEditorValidationReport,
  ValidationReportIssues,
} from "./content-editor.ts";

export type PinnedReleaseEntry = Readonly<{
  contentType: ContentType;
  contentKey: string;
  draftVersionId: string;
}>;

export interface ContentEditorStore {
  requireActiveRelease(): Promise<PublishedRelease>;
  hasReleaseEntry(
    releaseId: string,
    contentType: ContentType,
    contentKey: string,
  ): Promise<boolean>;
  listReleaseEntries(releaseId: string): Promise<readonly ContentEditorReleaseEntry[]>;
  maxDraftVersion(contentType: ContentType, contentKey: string): Promise<number>;
  appendDraftVersion(input: {
    contentType: ContentType;
    contentKey: string;
    document: unknown;
    version: number;
    schemaVersion: string;
    createdBy: string;
  }): Promise<{ id: string; version: number }>;
  findDraftVersion(id: string): Promise<ContentEditorDraftVersion | null>;
  insertCandidate(input: {
    expectedActiveReleaseId: string;
    createdBy: string;
    entries: readonly PinnedReleaseEntry[];
  }): Promise<string>;
  findCandidate(candidateId: string): Promise<ContentEditorCandidate | null>;
  listCandidateEntries(candidateId: string): Promise<readonly PinnedReleaseEntry[]>;
  listCandidateDocuments(candidateId: string): Promise<readonly ContentEditorDraftVersion[]>;
  setCandidateStatus(candidateId: string, status: ContentEditorCandidate["status"]): Promise<void>;
  insertValidationReport(input: {
    candidateId: string;
    validatorVersion: string;
    ok: boolean;
    issues: ValidationReportIssues;
  }): Promise<string>;
  latestValidationReport(candidateId: string): Promise<ContentEditorValidationReport | null>;
  persistPinnedBundle(
    bundle: ValidatedContentBundle,
    pinned: readonly PinnedReleaseEntry[],
  ): Promise<PublishedRelease>;
  recordPublicationAudit(input: {
    releaseId: string;
    candidateId: string;
    createdBy: string;
  }): Promise<void>;
}
