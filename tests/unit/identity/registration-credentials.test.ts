import { describe, expect, it } from "vitest";
import { RegistrationCredentials } from "../../../src/modules/identity/domain/registration-credentials.ts";
import { RegistrationValidationError } from "../../../src/modules/identity/domain/registration-validation-error.ts";

describe("RegistrationCredentials", () => {
  it("accepts a valid login, nick and password", () => {
    const credentials = RegistrationCredentials.parse("Hero_1", "Герой", "secret1");
    expect(credentials.login).toBe("hero_1");
    expect(credentials.nick).toBe("Герой");
    expect(credentials.password).toBe("secret1");
  });

  it("rejects missing, short or illegal fields", () => {
    expect(() => RegistrationCredentials.parse("", "Hero", "secret1")).toThrow(
      RegistrationValidationError,
    );
    expect(() => RegistrationCredentials.parse("ab", "Hero", "secret1")).toThrow(
      /Логин: 3–32 символа/,
    );
    expect(() => RegistrationCredentials.parse("hero", "ab", "secret1")).toThrow(
      /Имя персонажа: 3–20 символов/,
    );
    expect(() => RegistrationCredentials.parse("hero", "Hero", "12345")).toThrow(
      /Пароль: минимум 6 символов/,
    );
  });
});
