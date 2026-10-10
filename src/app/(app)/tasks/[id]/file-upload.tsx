"use client";

import { useRef, useState } from "react";
import { recordFile } from "./actions";
import { fileKind, thumbnailFor } from "@/lib/imagekit";

const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

export function FileUpload({ taskId }: { taskId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;

  if (!publicKey) {
    return (
      <p className="text-muted text-sm">
        File uploads need ImageKit keys in <code className="text-xs">.env.local</code>.
      </p>
    );
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      // The server signs a short-lived grant; the private key stays there.
      const grantRes = await fetch("/api/imagekit/auth");
      if (!grantRes.ok) {
        throw new Error(
          grantRes.status === 503
            ? "ImageKit isn't configured on the server yet."
            : "Couldn't get permission to upload.",
        );
      }
      const grant = await grantRes.json();

      const body = new FormData();
      body.append("file", file);
      body.append("fileName", file.name);
      body.append("publicKey", publicKey!);
      body.append("signature", grant.signature);
      body.append("expire", String(grant.expire));
      body.append("token", grant.token);
      body.append("folder", `/church-ops/tasks/${taskId}`);
      body.append("useUniqueFileName", "true");

      const uploadRes = await fetch(UPLOAD_URL, { method: "POST", body });
      const uploaded = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploaded?.message ?? "ImageKit rejected the upload.");
      }

      const kind = fileKind(file.type);
      const result = await recordFile(taskId, {
        imagekit_file_id: uploaded.fileId,
        name: uploaded.name ?? file.name,
        url: uploaded.url,
        thumbnail_url: uploaded.thumbnailUrl ?? thumbnailFor(uploaded.url, kind),
        kind,
        size_bytes: typeof uploaded.size === "number" ? uploaded.size : file.size,
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
    <div>
      <label
        className={
          busy
            ? "border-border text-muted inline-block cursor-wait rounded-md border px-3 py-2 text-sm font-medium"
            : "border-border hover:border-brand-500 hover:text-brand-700 inline-block cursor-pointer rounded-md border px-3 py-2 text-sm font-medium"
        }
      >
        {busy ? "Uploading…" : "Add a file"}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          disabled={busy}
          onChange={onPick}
        />
      </label>
      <p className="text-muted mt-1.5 text-xs">
        Documents, images and video. Everyone on this task can see them.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
