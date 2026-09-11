export class QuestDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestDeniedError";
  }
}
