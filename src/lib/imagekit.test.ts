import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  signUpload,
  fileKind,
  thumbnailFor,
  basicAuthHeader,
  GRANT_TTL_SECONDS,
} from "./imagekit.ts";

describe("signUpload", () => {
  test("matches an independently computed HMAC-SHA1", () => {
    const grant = signUpload("private_TESTKEY", 1_700_000_000, "fixed-token");
    const expected = createHmac("sha1", "private_TESTKEY")
      .update("fixed-token" + (1_700_000_000 + GRANT_TTL_SECONDS))
      .digest("hex");
    assert.equal(grant.signature, expected);
    assert.equal(grant.expire, 1_700_000_000 + GRANT_TTL_SECONDS);
    assert.equal(grant.token, "fixed-token");
  });

  test("the grant never contains the private key", () => {
    const grant = signUpload("private_SUPERSECRET", 1_700_000_000, "t");
    const serialized = JSON.stringify(grant);
    assert.ok(!serialized.includes("private_SUPERSECRET"));
    assert.ok(!serialized.includes("SUPERSECRET"));
  });

  test("a different key produces a different signature", () => {
    const a = signUpload("key-one", 1_700_000_000, "t");
    const b = signUpload("key-two", 1_700_000_000, "t");
    assert.notEqual(a.signature, b.signature);
  });

  test("each grant gets its own token by default", () => {
    const a = signUpload("k");
    const b = signUpload("k");
    assert.notEqual(a.token, b.token);
  });

  test("the grant expires in the future", () => {
    const now = Math.floor(Date.now() / 1000);
    assert.ok(signUpload("k").expire > now);
  });
});

describe("fileKind", () => {
  test("images, video and everything else", () => {
    assert.equal(fileKind("image/png"), "image");
    assert.equal(fileKind("image/heic"), "image");
    assert.equal(fileKind("video/mp4"), "video");
    assert.equal(fileKind("video/quicktime"), "video");
    assert.equal(fileKind("application/pdf"), "document");
    assert.equal(fileKind("text/plain"), "document");
    assert.equal(fileKind(""), "document");
  });
});

describe("thumbnailFor", () => {
  test("images get a resize transform", () => {
    assert.equal(
      thumbnailFor("https://ik.imagekit.io/x/a.png", "image"),
      "https://ik.imagekit.io/x/a.png?tr=w-320,h-320,c-at_max",
    );
  });

  test("video gets a frame grab", () => {
    assert.equal(
      thumbnailFor("https://ik.imagekit.io/x/a.mp4", "video"),
      "https://ik.imagekit.io/x/a.mp4/ik-thumbnail.jpg?tr=w-320",
    );
  });

  test("documents get none", () => {
    assert.equal(thumbnailFor("https://ik.imagekit.io/x/a.pdf", "document"), null);
  });
});

describe("basicAuthHeader", () => {
  test("encodes the private key as the username with an empty password", () => {
    const header = basicAuthHeader("private_abc123");
    assert.ok(header.startsWith("Basic "));
    const decoded = Buffer.from(header.slice(6), "base64").toString();
    assert.equal(decoded, "private_abc123:", "ImageKit wants key-colon, no password");
  });

  test("the key is not left in plain text in the header", () => {
    const header = basicAuthHeader("private_SECRET");
    assert.ok(!header.includes("private_SECRET"));
  });
});
