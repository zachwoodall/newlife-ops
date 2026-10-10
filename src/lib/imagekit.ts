import { createHmac, randomUUID } from "node:crypto";

export type UploadGrant = {
  token: string;
  expire: number;
  signature: string;
};

/** How long a browser has to use an upload grant. */
export const GRANT_TTL_SECONDS = 600;

/**
 * Sign a one-shot upload grant for the browser.
 *
 * ImageKit expects HMAC-SHA1 of (token + expire) keyed with the private key.
 * The private key never leaves the server; the browser only ever sees the
 * three values returned here, and they expire.
 */
export function signUpload(
  privateKey: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  token: string = randomUUID(),
): UploadGrant {
  const expire = nowSeconds + GRANT_TTL_SECONDS;
  const signature = createHmac("sha1", privateKey)
    .update(token + expire)
    .digest("hex");
  return { token, expire, signature };
}

/** Group a MIME type into the three kinds the board renders. */
export function fileKind(mime: string): "image" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** ImageKit builds thumbnails by URL transform; documents have none. */
export function thumbnailFor(
  url: string,
  kind: "image" | "video" | "document",
): string | null {
  if (kind === "image") return `${url}?tr=w-320,h-320,c-at_max`;
  if (kind === "video") return `${url}/ik-thumbnail.jpg?tr=w-320`;
  return null;
}

/**
 * ImageKit authenticates management calls with HTTP Basic, using the private
 * key as the username and no password.
 */
export function basicAuthHeader(privateKey: string): string {
  return "Basic " + Buffer.from(`${privateKey}:`).toString("base64");
}

export type DeleteResult = { ok: true } | { ok: false; reason: string };

/**
 * Removes the stored bytes from ImageKit. Server-side only — this is the one
 * place the private key is used against their API.
 *
 * A 404 counts as success: the goal is "this file is gone", and a file that
 * was already removed satisfies that.
 */
export async function deleteFromImageKit(fileId: string): Promise<DeleteResult> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) return { ok: false, reason: "ImageKit is not configured." };

  try {
    const res = await fetch(
      `https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE", headers: { Authorization: basicAuthHeader(privateKey) } },
    );
    if (res.status === 204 || res.status === 404) return { ok: true };
    return { ok: false, reason: `ImageKit returned ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Network error" };
  }
}
