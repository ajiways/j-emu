import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application } from "../../src/app/application.ts";
import { SESSION_COOKIE_NAMES } from "../../src/modules/jugger-wire/infrastructure/http/session-cookies.ts";
import { ApplicationHarness } from "../support/harness/application-harness.ts";
import {
  cookieHeaderFromSetCookie,
  cookieMapFromSetCookie,
  formBody,
  REQUIRED_FLASH_VAR_KEYS,
} from "../support/harness/browser-auth.ts";
import { CLIENT_STATIC_PATHS } from "../support/harness/client-static-stubs.ts";
import { uniqueDevelopmentSlot } from "../support/harness/unique-development-slot.ts";

const formHeaders = {
  "content-type": "application/x-www-form-urlencoded",
} as const;

describe("browser auth and game shell", () => {
  let harness: ApplicationHarness;
  let application: Application;

  beforeEach(async () => {
    harness = new ApplicationHarness();
    application = await harness.start();
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("serves login HTML on /, /login and /login.php", async () => {
    for (const url of ["/", "/login", "/login.php"]) {
      const response = await application.http.inject({ method: "GET", url });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.body).toContain('action="/login"');
      expect(response.body).toContain('name="login"');
      expect(response.body).toContain('name="password"');
    }
  });

  it("registers, redirects, sets five cookies on game.php 200, and restores the session from cookies", async () => {
    const login = `u${uniqueDevelopmentSlot()}`;
    const nick = `N${uniqueDevelopmentSlot()}`;
    const password = "secret1";

    const registered = await application.http.inject({
      method: "POST",
      url: "/register",
      headers: formHeaders,
      payload: formBody({ nick, login, password }),
    });
    expect(registered.statusCode).toBe(302);
    const location = registered.headers.location;
    if (typeof location !== "string") throw new Error("register did not redirect");
    expect(location).toMatch(/^\/game\.php\?_s=.+&_k=.+&_u=\d+$/);
    expect(registered.headers["set-cookie"]).toBeUndefined();

    const handoff = await application.http.inject({ method: "GET", url: location });
    expect(handoff.statusCode).toBe(200);
    const cookies = cookieMapFromSetCookie(handoff.headers["set-cookie"]);
    expect([...cookies.keys()].sort()).toEqual([...SESSION_COOKIE_NAMES].sort());
    expect(cookies.get("sstype")).toBe("18");
    expect(cookies.get("sess_uid")).toBe(cookies.get("cid"));
    expect(handoff.body).toContain("application/x-shockwave-flash");
    expect(handoff.body).toContain("main.swf");
    expect(handoff.body).toContain('history.replaceState(null, "", "/game.php")');
    for (const key of REQUIRED_FLASH_VAR_KEYS) {
      expect(handoff.body).toContain(`${key}=`);
    }
    expect(handoff.body).toContain(`nick=${encodeURIComponent(nick)}`);

    const restored = await application.http.inject({
      method: "GET",
      url: "/game.php",
      headers: { cookie: cookieHeaderFromSetCookie(handoff.headers["set-cookie"]) },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.body).toContain("main.swf");
    expect(restored.body).toContain(`nick=${encodeURIComponent(nick)}`);

    const loggedIn = await application.http.inject({
      method: "POST",
      url: "/login",
      headers: formHeaders,
      payload: formBody({ login, password }),
    });
    expect(loggedIn.statusCode).toBe(302);
    if (typeof loggedIn.headers.location !== "string") throw new Error("login did not redirect");
    expect(loggedIn.headers.location).toMatch(/^\/game\.php\?/);

    const logout = await application.http.inject({
      method: "GET",
      url: "/logout",
      headers: { cookie: cookieHeaderFromSetCookie(handoff.headers["set-cookie"]) },
    });
    expect(logout.statusCode).toBe(302);
    expect(logout.headers.location).toBe("/login");
    const afterLogout = await application.http.inject({
      method: "GET",
      url: "/game.php",
      headers: { cookie: cookieHeaderFromSetCookie(handoff.headers["set-cookie"]) },
    });
    expect(afterLogout.statusCode).toBe(302);
    expect(afterLogout.headers.location).toBe("/login");
  });

  it("rejects a duplicate login and nick with a diagnostic HTML error", async () => {
    const login = `u${uniqueDevelopmentSlot()}`;
    const nick = `N${uniqueDevelopmentSlot()}`;
    const first = await application.http.inject({
      method: "POST",
      url: "/register",
      headers: formHeaders,
      payload: formBody({ nick, login, password: "secret1" }),
    });
    expect(first.statusCode).toBe(302);

    const duplicateLogin = await application.http.inject({
      method: "POST",
      url: "/register",
      headers: formHeaders,
      payload: formBody({ nick: `N${uniqueDevelopmentSlot()}`, login, password: "secret1" }),
    });
    expect(duplicateLogin.statusCode).toBe(200);
    expect(duplicateLogin.body).toContain("Логин уже занят");

    const duplicateNick = await application.http.inject({
      method: "POST",
      url: "/register",
      headers: formHeaders,
      payload: formBody({ nick, login: `u${uniqueDevelopmentSlot()}`, password: "secret1" }),
    });
    expect(duplicateNick.statusCode).toBe(200);
    expect(duplicateNick.body).toContain("Имя персонажа уже занято");
  });

  it("redirects game.php without a session and accepts POST /game.php", async () => {
    const missing = await application.http.inject({ method: "GET", url: "/game.php" });
    expect(missing.statusCode).toBe(302);
    expect(missing.headers.location).toBe("/login");

    const unknown = await application.http.inject({
      method: "GET",
      url: "/game.php?_s=missing&_k=missing&_u=1",
    });
    expect(unknown.statusCode).toBe(302);
    expect(unknown.headers.location).toBe("/login");
    expect(unknown.headers["set-cookie"]).toBeUndefined();

    const post = await application.http.inject({ method: "POST", url: "/game.php" });
    expect(post.statusCode).toBe(200);
    expect(post.body).toBe("ok");
  });

  it("serves confirmed client static URLs from the Pub1 root", async () => {
    for (const relative of CLIENT_STATIC_PATHS) {
      const response = await application.http.inject({ method: "GET", url: `/${relative}` });
      expect(response.statusCode, relative).toBe(200);
    }
  });

  it("requires an explicit positive development slot", async () => {
    const missing = await application.http.inject({ method: "GET", url: "/soc_auth.php" });
    expect(missing.statusCode).toBe(400);
    const zero = await application.http.inject({ method: "GET", url: "/soc_auth.php?slot=0" });
    expect(zero.statusCode).toBe(400);
  });
});
