import { useEffect } from "react";
import { supabase } from "../supabase";

// 🔔 Real native push notifications (Capacitor + Firebase Cloud Messaging).
// Only runs inside the packaged Android app -- on web this hook is a no-op
// (the app already has a separate browser Notification API path for that).
//
// Requires, on the native build side (not handled by this file):
//   1. `npm install @capacitor/push-notifications` then `npx cap sync android`
//   2. `android/app/google-services.json` present (already required for the
//      existing @capacitor-firebase/app-check integration, so it should
//      already be there)
//   3. Rebuild the APK after step 1-2 -- this hook silently no-ops until
//      the plugin is actually installed and synced.
//
// Flow: on native app launch, ask for notification permission -> register
// with FCM -> Capacitor fires back a device token -> save it to this user's
// row in Supabase (users.fcm_token) so the server can target this device
// later via api/send-push.ts's sendPushToUid().
export function usePushNotifications(uid: string | null | undefined) {
  useEffect(() => {
    if (!uid) return;
    const w = window as any;
    if (!w.Capacitor || typeof w.Capacitor.isNativePlatform !== "function" || !w.Capacitor.isNativePlatform()) {
      return; // web -- nothing to do here
    }

    let cancelled = false;

    (async () => {
      try {
        // Dynamic import so this optional native dependency never breaks
        // the web build if it isn't installed yet.
        const { PushNotifications } = await import(
          /* @vite-ignore */ "@capacitor/push-notifications"
        );

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== "granted") return;

        await PushNotifications.register();

        PushNotifications.addListener("registration", async (token: { value: string }) => {
          if (cancelled || !token?.value) return;
          try {
            await supabase.from("users").update({ fcm_token: token.value }).eq("uid", uid);
          } catch (e) {
            console.warn("Failed to save FCM token:", e);
          }
        });

        PushNotifications.addListener("registrationError", (err: any) => {
          console.warn("FCM registration failed:", err);
        });
      } catch (e) {
        // @capacitor/push-notifications not installed yet -- silently skip,
        // this hook becomes active once the package is added and cap-synced.
        console.warn("Push notifications plugin unavailable:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);
}
