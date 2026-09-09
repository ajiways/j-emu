export class HuntJoinDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HuntJoinDenied";
  }
}
