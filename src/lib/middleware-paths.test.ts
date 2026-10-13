/**
 * The two self-authenticating API routes must not be redirected to /login,
 * and nothing else may be let through by accident.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Read the list straight from the middleware so the test cannot drift. */
function publicPaths(): string[] {
  const src = readFileSync("src/middleware.ts", "utf8");
  const block = src.match(/const PUBLIC_PATHS = \[([\s\S]*?)\];/);
  assert.ok(block, "PUBLIC_PATHS should be a literal array");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const isPublic = (pathname: string) =>
  publicPaths().some((p) => pathname.startsWith(p));

describe("public paths", () => {
  test("the calendar feed is reachable without a session", () => {
    assert.ok(
      isPublic("/api/calendar/0b7c2f4e-0000-0000-0000-000000000000"),
      "calendar apps cannot sign in; the token is the credential",
    );
  });

  test("the scheduled email sender is reachable without a session", () => {
    assert.ok(isPublic("/api/notifications/send"));
  });

  test("login remains public", () => {
    assert.ok(isPublic("/login"));
    assert.ok(isPublic("/auth/callback"));
  });
});

describe("everything else still requires a session", () => {
  for (const path of [
    "/",
    "/tasks",
    "/tasks/abc",
    "/weekly",
    "/calendar",
    "/messages",
    "/announcements",
    "/checkins",
    "/files",
    "/search",
    "/notifications",
    "/api/imagekit/auth",
  ]) {
    test(`${path} is protected`, () => {
      assert.equal(isPublic(path), false);
    });
  }

  test("the imagekit signing endpoint is NOT covered by the notifications prefix", () => {
    // /api/notifications is public; /api/imagekit must not be swept in with it.
    assert.equal(isPublic("/api/imagekit/auth"), false);
  });
});
