export class DuplicateAccountError extends Error {
  constructor(readonly field: "login" | "nick") {
    super(field === "login" ? "Логин уже занят. Выберите другой." : "Имя персонажа уже занято.");
    this.name = "DuplicateAccountError";
  }
}
