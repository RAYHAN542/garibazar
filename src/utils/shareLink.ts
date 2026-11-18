import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

// Android WebView has no navigator.share, so in the app we use the native
// Capacitor Share sheet. On the web we keep navigator.share as before.
export const canShare = (): boolean =>
  Capacitor.isNativePlatform() || (typeof navigator !== "undefined" && !!(navigator as any).share);

export async function shareLink(opts: { title: string; text: string; url: string }): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title });
    } catch (e: any) {
      // user closed the share sheet: not an error, do not fall back to copy
      if (/cancel/i.test(String(e?.message || e))) return;
      throw e;
    }
    return;
  }
  await (navigator as any).share(opts);
}
