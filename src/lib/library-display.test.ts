import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { displayImage, type LibraryFile } from "./library-display.ts";

const file = (over: Partial<LibraryFile> = {}): LibraryFile => ({
  id: "f1",
  name: "training.mp4",
  url: "https://ik.test/a.mp4",
  thumbnail_url: "https://ik.test/a.mp4/ik-thumbnail.jpg",
  cover_url: null,
  cover_file_id: null,
  kind: "video",
  size_bytes: 1024,
  department: null,
  folder_id: null,
  uploaded_by: "p1",
  created_at: "2026-10-12T10:00:00Z",
  ...over,
});

describe("displayImage", () => {
  test("prefers a cover you chose", () => {
    assert.equal(
      displayImage(file({ cover_url: "https://ik.test/cover.png" })),
      "https://ik.test/cover.png",
    );
  });

  test("falls back to the generated thumbnail when there is no cover", () => {
    assert.equal(displayImage(file()), "https://ik.test/a.mp4/ik-thumbnail.jpg");
  });

  test("removing a cover restores the generated thumbnail rather than nothing", () => {
    const withCover = file({ cover_url: "https://ik.test/cover.png" });
    const removed = { ...withCover, cover_url: null };
    assert.equal(displayImage(removed), "https://ik.test/a.mp4/ik-thumbnail.jpg");
  });

  test("a document with neither has no picture", () => {
    assert.equal(displayImage(file({ kind: "document", thumbnail_url: null })), null);
  });

  test("a document can still be given a cover", () => {
    assert.equal(
      displayImage(file({ kind: "document", thumbnail_url: null, cover_url: "https://ik.test/c.png" })),
      "https://ik.test/c.png",
    );
  });
});
