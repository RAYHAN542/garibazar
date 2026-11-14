package shop.garibazar.twa;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;

import me.leolin.shortcutbadger.ShortcutBadger;

/**
 * Handles DATA-ONLY push (data.gb == "1") sent for devices that carry this service:
 * builds the notification itself and sets the launcher icon badge count.
 * Everything else is passed to Capacitor's normal MessagingService.
 */
public class GariFcmService extends MessagingService {
    private static final String CHANNEL_ID = "gb_push";
    private static final String PREFS = "gb_badge";
    private static final String KEY_COUNT = "count";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (data == null || !"1".equals(data.get("gb"))) {
            super.onMessageReceived(message);
            return;
        }
        try {
            showNotification(message, data);
        } catch (Throwable t) {
            // never crash the service
        }
    }

    private boolean isAppInForeground() {
        try {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return false;
            List<ActivityManager.RunningAppProcessInfo> list = am.getRunningAppProcesses();
            if (list == null) return false;
            for (ActivityManager.RunningAppProcessInfo p : list) {
                if (p.processName != null && p.processName.equals(getPackageName())) {
                    return p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND;
                }
            }
        } catch (Throwable t) {
            // ignore
        }
        return false;
    }

    private void showNotification(RemoteMessage message, Map<String, String> data) {
        if (isAppInForeground()) return;
        Context ctx = getApplicationContext();
        String title = nz(data.get("gb_title"));
        String body = nz(data.get("gb_body"));
        String image = data.get("gb_image");

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "GariBazar", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(ch);
        }

        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) launch = new Intent(ctx, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (Map.Entry<String, String> e : data.entrySet()) {
            String k = e.getKey();
            if (k.equals("gb") || k.startsWith("gb_")) continue;
            launch.putExtra(k, e.getValue());
        }
        String mid = message.getMessageId();
        launch.putExtra("google.message_id", mid != null ? mid : String.valueOf(System.currentTimeMillis()));

        int id = (int) (System.nanoTime() & 0x7fffffff);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pi);
        Bitmap bmp = loadBitmap(image);
        if (bmp != null) {
            b.setStyle(new NotificationCompat.BigPictureStyle().bigPicture(bmp));
        } else {
            b.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        }
        nm.notify(id, b.build());

        int count = bump(ctx);
        try {
            ShortcutBadger.applyCount(ctx, count);
        } catch (Throwable t) {
            // launcher without badge support
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private Bitmap loadBitmap(String url) {
        if (url == null || !url.startsWith("https://")) return null;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(4000);
            c.setReadTimeout(4000);
            InputStream in = c.getInputStream();
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inSampleSize = 2;
            Bitmap bmp = BitmapFactory.decodeStream(in, null, o);
            in.close();
            return bmp;
        } catch (Throwable t) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static int bump(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int c = Math.min(sp.getInt(KEY_COUNT, 0) + 1, 99);
        sp.edit().putInt(KEY_COUNT, c).apply();
        return c;
    }

    public static void resetBadge(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(KEY_COUNT, 0).apply();
        try {
            ShortcutBadger.removeCount(ctx);
        } catch (Throwable t) {
            // ignore
        }
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();
    }
}
