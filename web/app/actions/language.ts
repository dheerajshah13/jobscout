"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const LANG_COOKIE = "jobscout-lang";

export async function setLanguage(formData: FormData) {
  const lang = String(formData.get("lang"));
  if (lang !== "en" && lang !== "de") return;

  const cookieStore = await cookies();
  cookieStore.set(LANG_COOKIE, lang, { maxAge: 60 * 60 * 24 * 365, path: "/" });

  const redirectPath = String(formData.get("redirectPath") ?? "/");
  revalidatePath(redirectPath);
  revalidatePath("/", "layout");
}

export async function getLanguage(): Promise<"en" | "de"> {
  const cookieStore = await cookies();
  const lang = cookieStore.get(LANG_COOKIE)?.value;
  return lang === "de" ? "de" : "en";
}
