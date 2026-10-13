"use client";

import { useRef, useState } from "react";
import { setCover } from "./actions";

const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

/** Uploads a cover image for one file, replacing any previous one. */
export function CoverUpload({
  fileId,
  hasCover,
}: {
  fileId: string;
  hasCover: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  if (!publicKey) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("A cover has to be an image.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const grantRes = await fetch("/api/imagekit/auth");
      if (!grantRes.ok) throw new Error("Couldn't get permission to upload.");
      const grant = await grantRes.json();

      const body = new FormData();
      body.append("file", file);
      body.append("fileName", `cover-${file.name}`);
      body.append("publicKey", publicKey!);
      body.append("signature", grant.signature);
      body.append("expire", String(grant.expire));
      body.append("token", grant.token);
      body.append("folder", "/church-ops/covers");
      body.append("useUniqueFileName", "true");

      const res = await fetch(UPLOAD_URL, { method: "POST", body });
      const uploaded = await res.json();
      if (!res.ok) throw new Error(uploaded?.message ?? "ImageKit rejected the image.");

      const result = await setCover(fileId, {
        url: uploaded.url,
        fileId: uploaded.fileId,
      });
      if ("error" in result) throw new Error(result.error);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label
        className={
          busy
            ? "text-muted cursor-wait text-xs font-medium"
            : "text-muted hover:text-brand-700 cursor-pointer text-xs font-medium"
        }
      >
        {busy ? "Uploading…" : hasCover ? "Change cover" : "Add cover"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={onPick}
        />
      </label>
      {error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </>
  );
}
