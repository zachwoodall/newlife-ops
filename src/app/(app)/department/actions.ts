"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CAMPUS_COOKIE } from "@/lib/campus";

export async function setCampus(formData: FormData) {
  const campus = String(formData.get("campus") ?? "");
  const store = await cookies();
  store.set(CAMPUS_COOKIE, campus, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/department");
}
