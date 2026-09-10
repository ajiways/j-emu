export interface UnreadMailQuery {
  hasUnread(heroId: number): Promise<boolean>;
}
