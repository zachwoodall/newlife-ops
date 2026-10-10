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
