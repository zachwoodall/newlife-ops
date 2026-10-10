import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signUpload } from "@/lib/imagekit";

/**
 * Hands the browser a short-lived, signed permission to upload one file.
 * Signed in only — otherwise this endpoint is an open upload relay for
 * anyone who finds the URL.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { error: "ImageKit is not configured yet." },
      { status: 503 },
    );
  }

  return NextResponse.json(signUpload(privateKey), {
    headers: { "Cache-Control": "no-store" },
  });
}
