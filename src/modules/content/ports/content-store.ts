import type { PublishedRelease, ValidatedContentBundle } from "../domain/content-document.ts";

export interface ContentStore {
  lockPublication(): Promise<void>;
  findBootstrap(digest: string): Promise<PublishedRelease | null>;
  hasAnyRelease(): Promise<boolean>;
  findByChecksum(checksum: string): Promise<PublishedRelease | null>;
  persistValidatedBundle(bundle: ValidatedContentBundle): Promise<PublishedRelease>;
  activate(releaseId: string): Promise<void>;
  recordBootstrap(digest: string, releaseId: string, source: string): Promise<void>;
}
