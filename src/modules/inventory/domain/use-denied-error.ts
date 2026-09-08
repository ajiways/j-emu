export class UseDeniedError extends Error {
  static readonly missingItem = "предмет не найден";
  static readonly notInBag = "снимите предмет чтобы использовать";
  static readonly noAction = "у предмета нет действия использования";
  static readonly badEffect = "некорректный эффект";

  constructor(message: string) {
    super(message);
    this.name = "UseDeniedError";
  }

  static itemMissing(): UseDeniedError {
    return new UseDeniedError(UseDeniedError.missingItem);
  }

  static mustUnequip(): UseDeniedError {
    return new UseDeniedError(UseDeniedError.notInBag);
  }

  static withoutAction(): UseDeniedError {
    return new UseDeniedError(UseDeniedError.noAction);
  }

  static unsupported(code: string): UseDeniedError {
    if (!code) throw new Error("Unsupported USE code is required");
    return new UseDeniedError(`действие «${code}» пока не поддержано`);
  }

  static invalidEffect(): UseDeniedError {
    return new UseDeniedError(UseDeniedError.badEffect);
  }
}
