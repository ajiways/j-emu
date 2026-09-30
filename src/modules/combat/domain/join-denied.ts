export class JoinDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JoinDenied";
  }
}
