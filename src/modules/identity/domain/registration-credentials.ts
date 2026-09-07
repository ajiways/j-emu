import { RegistrationValidationError } from "./registration-validation-error.ts";

const LOGIN_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
const NICK_PATTERN = /^[A-Za-zА-Яа-яЁё0-9_-]{3,20}$/;

export class RegistrationCredentials {
  private constructor(
    readonly login: string,
    readonly nick: string,
    readonly password: string,
  ) {}

  static parse(login: unknown, nick: unknown, password: unknown): RegistrationCredentials {
    if (typeof login !== "string" || typeof nick !== "string" || typeof password !== "string") {
      throw new RegistrationValidationError("Заполните все поля.");
    }
    const trimmedLogin = login.trim();
    const trimmedNick = nick.trim();
    if (!trimmedLogin || !trimmedNick || password.length === 0) {
      throw new RegistrationValidationError("Заполните все поля.");
    }
    if (!NICK_PATTERN.test(trimmedNick)) {
      throw new RegistrationValidationError(
        "Имя персонажа: 3–20 символов, латиница или кириллица.",
      );
    }
    if (!LOGIN_PATTERN.test(trimmedLogin)) {
      throw new RegistrationValidationError("Логин: 3–32 символа.");
    }
    if (password.length < 6) {
      throw new RegistrationValidationError("Пароль: минимум 6 символов.");
    }
    return new RegistrationCredentials(trimmedLogin.toLowerCase(), trimmedNick, password);
  }
}
