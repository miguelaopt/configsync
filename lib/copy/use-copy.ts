"use client";
import { toast } from "sonner";

/** Copies text; falls back to a hidden textarea on insecure origins (e.g. http:// on a LAN). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyWithToast(text: string, message: string) {
  const ok = await copyText(text);
  if (ok) toast.success(message);
  else toast.error("Couldn't access the clipboard. Select the text and copy it manually.");
  return ok;
}
