export interface SessionPresence {
  listAccountIdsWithSession(): Promise<readonly number[]>;
}
