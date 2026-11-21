import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "../supabase";

// Native push (Capacitor + FCM). Web-এ no-op।
export function usePushNotifications(uid: string | null | undefined) {
  useEffect(() => {
    if (!uid) return;
    const w = window as any;
    if (
      !w.Capacitor ||
      typeof w.Capacitor.isNativePlatform !== "function" ||
      !w.Capacitor.isNativePlatform()
    ) {
      return;
    }

    let cancelled = false;
    const handles: any[] = [];

    (async () => {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") return;

        handles.push(
          await PushNotifications.addListener("registration", async (token) => {
            if (cancelled || !token?.value) return;
            try {
              await supabase
                .from("users")
                .update({ fcm_token: token.value })
                .eq("uid", uid);
            } catch (e) {
              console.warn("Failed to save FCM token:", e);
            }
          })
        );
        handles.push(
          await PushNotifications.addListener("registrationError", (err: any) => {
            console.warn("FCM registration failed:", err);
          })
        );

        handles.push(
          await PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action: any) => {
              const data = action?.notification?.data || {};
              try {
                const n: any = action?.notification || {};
                const id = String(n.id || Date.now());
                const old = JSON.parse(localStorage.getItem("gari_push_inbox") || "[]");
                const list = [{ id, title: String(data.gb_title || n.title || ""), body: String(data.gb_body || n.body || ""), chatId: data.chatId ? String(data.chatId) : "", listingId: data.listingId ? String(data.listingId) : "", ts: Date.now() }, ...old.filter((x: any) => x.id !== id)];
                localStorage.setItem("gari_push_inbox", JSON.stringify(list.slice(0, 20)));
              } catch (_) {}
              window.dispatchEvent(new CustomEvent("gari_push_open", { detail: data }));
            }
          )
        );

        await PushNotifications.register();
      } catch (e) {
        console.warn("Push notifications error:", e);
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => h?.remove?.());
    };
  }, [uid]);
}
