export class ContentEditorError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422,
    message: string,
    readonly reportId?: string,
  ) {
    super(message);
    this.name = "ContentEditorError";
  }
}
