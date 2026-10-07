package shop.garibazar.twa;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Native Advanced ad ফিড কার্ডের মতো দেখাতে: ad-টা WebView-এর ওপরে native view হিসেবে বসে,
 * JS থেকে x/y/width/height (CSS px) পেয়ে জায়গা মেলায়। ad HTML-এ আঁকা হয় না (AdMob নীতি)।
 */
@CapacitorPlugin(name = "NativeAds")
public class NativeAdsPlugin extends Plugin {

    private static class Slot {
        NativeAd ad;
        NativeAdView adView;
        FrameLayout container;
        long lastTouch;
    }

    private final Map<String, Slot> slots = new HashMap<>();

    // পাহারাদার: JS ২.৫ সেকেন্ড সাড়া না দিলে (পেজ রিলোড/Back) ad লুকিয়ে ফেলে।
    private final android.os.Handler wdHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean wdRunning = false;
    private final Runnable watchdog = new Runnable() {
        @Override
        public void run() {
            long now = android.os.SystemClock.uptimeMillis();
            for (Slot sl : new ArrayList<>(slots.values())) {
                if (sl.container != null && sl.container.getVisibility() == View.VISIBLE
                        && now - sl.lastTouch > 2500) {
                    sl.container.setVisibility(View.GONE);
                }
            }
            wdHandler.postDelayed(this, 1000);
        }
    };

    private void ensureWatchdog() {
        if (!wdRunning) {
            wdRunning = true;
            wdHandler.postDelayed(watchdog, 1000);
        }
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, v, getContext().getResources().getDisplayMetrics()));
    }

    private GradientDrawable roundRect(int fill, int radiusPx, int strokeColor, int strokePx) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(radiusPx);
        if (strokePx > 0) g.setStroke(strokePx, strokeColor);
        return g;
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        final List<String> testIds = new ArrayList<>();
        try {
            if (call.getArray("testDeviceIds") != null) {
                testIds.addAll(call.getArray("testDeviceIds").<String>toList());
            }
        } catch (Exception ignored) {
        }
        getActivity().runOnUiThread(() -> {
            RequestConfiguration.Builder cfg = new RequestConfiguration.Builder()
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG);
            if (!testIds.isEmpty()) cfg.setTestDeviceIds(testIds);
            MobileAds.setRequestConfiguration(cfg.build());
            MobileAds.initialize(getContext(), status -> call.resolve());
        });
    }

    /** Play Store থেকে ইনস্টল হলে fromPlayStore=true; sideload/APK হলে false। */
    @PluginMethod
    public void installSource(PluginCall call) {
        String installer = null;
        try {
            String pkg = getContext().getPackageName();
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                installer = getContext().getPackageManager().getInstallSourceInfo(pkg).getInstallingPackageName();
            } else {
                installer = getContext().getPackageManager().getInstallerPackageName(pkg);
            }
        } catch (Exception ignored) {
        }
        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
        ret.put("fromPlayStore", "com.android.vending".equals(installer));
        ret.put("installer", installer == null ? "" : installer);
        call.resolve(ret);
    }

    @PluginMethod
    public void load(PluginCall call) {
        final String id = call.getString("id");
        final String adUnitId = call.getString("adUnitId");
        if (id == null || adUnitId == null) {
            call.reject("id and adUnitId are required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            destroySlot(id);
            AdLoader loader = new AdLoader.Builder(getContext(), adUnitId)
                .forNativeAd(nativeAd -> {
                    Slot slot = new Slot();
                    slot.ad = nativeAd;
                    buildViews(slot, nativeAd);
                    slots.put(id, slot);
                    call.resolve();
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        call.reject("load failed: " + error.getCode() + " " + error.getMessage());
                    }
                })
                .withNativeAdOptions(new NativeAdOptions.Builder().build())
                .build();
            loader.loadAd(new AdRequest.Builder().build());
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        final String id = call.getString("id");
        final float x = call.getFloat("x", 0f);
        final float y = call.getFloat("y", 0f);
        final float w = call.getFloat("width", 0f);
        final float h = call.getFloat("height", 0f);
        final float clipTop = call.getFloat("clipTop", 0f);
        final float clipBottom = call.getFloat("clipBottom", 100000f);
        getActivity().runOnUiThread(() -> {
            Slot s = id == null ? null : slots.get(id);
            if (s == null) {
                call.reject("slot not loaded");
                return;
            }
            position(s, x, y, w, h, clipTop, clipBottom);
            call.resolve();
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        final String id = call.getString("id");
        getActivity().runOnUiThread(() -> {
            Slot s = id == null ? null : slots.get(id);
            if (s != null) s.container.setVisibility(View.GONE);
            call.resolve();
        });
    }

    @PluginMethod
    public void destroy(PluginCall call) {
        final String id = call.getString("id");
        getActivity().runOnUiThread(() -> {
            if (id != null) destroySlot(id);
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        for (String id : new ArrayList<>(slots.keySet())) destroySlot(id);
    }

    private void destroySlot(String id) {
        Slot s = slots.remove(id);
        if (s == null) return;
        if (s.container != null && s.container.getParent() != null) {
            ((ViewGroup) s.container.getParent()).removeView(s.container);
        }
        if (s.adView != null) s.adView.destroy();
        if (s.ad != null) s.ad.destroy();
    }

    private void position(Slot s, float x, float y, float w, float h, float clipTop, float clipBottom) {
        s.lastTouch = android.os.SystemClock.uptimeMillis();
        ensureWatchdog();
        View web = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) web.getParent();
        float d = getContext().getResources().getDisplayMetrics().density;
        int wp = Math.round(w * d);
        int hp = Math.round(h * d);
        if (wp <= 0 || hp <= 0) {
            s.container.setVisibility(View.GONE);
            return;
        }
        if (s.container.getParent() == null) {
            parent.addView(s.container, new FrameLayout.LayoutParams(wp, hp));
        } else {
            ViewGroup.LayoutParams lp = s.container.getLayoutParams();
            if (lp.width != wp || lp.height != hp) {
                lp.width = wp;
                lp.height = hp;
                s.container.setLayoutParams(lp);
            }
        }
        s.container.setX(web.getX() + x * d);
        s.container.setY(web.getY() + y * d);

        float visTop = Math.max(0f, (clipTop - y) * d);
        float visBottom = Math.min((float) hp, (clipBottom - y) * d);
        if (visBottom - visTop < 2f) {
            s.container.setVisibility(View.GONE);
            return;
        }
        s.container.setClipBounds(new Rect(0, Math.round(visTop), wp, Math.round(visBottom)));
        s.container.setVisibility(View.VISIBLE);
    }

    private void buildViews(Slot slot, NativeAd nativeAd) {
        Context ctx = getContext();
        NativeAdView adView = new NativeAdView(ctx);
        adView.setBackground(roundRect(Color.WHITE, dp(12), Color.parseColor("#E2E8F0"), dp(1)));

        LinearLayout root = new LinearLayout(ctx);
        root.setOrientation(LinearLayout.VERTICAL);

        MediaView media = new MediaView(ctx);
        media.setImageScaleType(ImageView.ScaleType.CENTER_CROP);
        root.addView(media, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout info = new LinearLayout(ctx);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setPadding(dp(12), dp(8), dp(12), dp(8));

        LinearLayout row = new LinearLayout(ctx);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        ImageView icon = new ImageView(ctx);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(36), dp(36));
        iconLp.rightMargin = dp(10);
        row.addView(icon, iconLp);

        LinearLayout titles = new LinearLayout(ctx);
        titles.setOrientation(LinearLayout.VERTICAL);

        TextView headline = new TextView(ctx);
        headline.setTextColor(Color.parseColor("#0F172A"));
        headline.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        headline.setTypeface(Typeface.DEFAULT_BOLD);
        headline.setMaxLines(1);
        headline.setEllipsize(TextUtils.TruncateAt.END);
        titles.addView(headline);

        LinearLayout meta = new LinearLayout(ctx);
        meta.setOrientation(LinearLayout.HORIZONTAL);
        meta.setGravity(Gravity.CENTER_VERTICAL);

        TextView badge = new TextView(ctx);
        badge.setText("Ad");
        badge.setTextColor(Color.WHITE);
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setPadding(dp(5), dp(1), dp(5), dp(1));
        badge.setBackground(roundRect(Color.parseColor("#F59E0B"), dp(4), 0, 0));
        LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        badgeLp.rightMargin = dp(6);
        meta.addView(badge, badgeLp);

        TextView advertiser = new TextView(ctx);
        advertiser.setTextColor(Color.parseColor("#64748B"));
        advertiser.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        advertiser.setMaxLines(1);
        advertiser.setEllipsize(TextUtils.TruncateAt.END);
        meta.addView(advertiser);
        titles.addView(meta);

        row.addView(titles, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        info.addView(row);

        TextView body = new TextView(ctx);
        body.setTextColor(Color.parseColor("#475569"));
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        body.setMaxLines(2);
        body.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams bodyLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bodyLp.topMargin = dp(6);
        body.setVisibility(View.GONE); // কমপ্যাক্ট: বর্ণনা লুকানো
        info.addView(body, bodyLp);

        Button cta = new Button(ctx);
        cta.setAllCaps(false);
        cta.setTextColor(Color.WHITE);
        cta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cta.setMinHeight(0);
        cta.setMinimumHeight(0);
        cta.setPadding(dp(8), 0, dp(8), 0);
        cta.setBackground(roundRect(Color.parseColor("#16A34A"), dp(10), 0, 0));
        LinearLayout.LayoutParams ctaLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, dp(36));
        ctaLp.leftMargin = dp(8);
        cta.setMinWidth(dp(88));
        row.addView(cta, ctaLp);

        root.addView(info, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        adView.addView(root, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        adView.setMediaView(media);
        adView.setHeadlineView(headline);
        adView.setBodyView(body);
        adView.setCallToActionView(cta);
        adView.setIconView(icon);
        adView.setAdvertiserView(advertiser);

        headline.setText(nativeAd.getHeadline());
        if (nativeAd.getBody() == null) body.setVisibility(View.GONE);
        else body.setText(nativeAd.getBody());
        if (nativeAd.getCallToAction() == null) cta.setVisibility(View.GONE);
        else cta.setText(nativeAd.getCallToAction());
        if (nativeAd.getIcon() == null || nativeAd.getIcon().getDrawable() == null) {
            icon.setVisibility(View.GONE);
        } else {
            icon.setImageDrawable(nativeAd.getIcon().getDrawable());
        }
        if (nativeAd.getAdvertiser() == null) advertiser.setVisibility(View.GONE);
        else advertiser.setText(nativeAd.getAdvertiser());
        if (nativeAd.getMediaContent() != null) media.setMediaContent(nativeAd.getMediaContent());
        else media.setVisibility(View.GONE);

        adView.setNativeAd(nativeAd);

        TouchForwardLayout container = new TouchForwardLayout(ctx, getBridge().getWebView());
        container.addView(adView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        slot.adView = adView;
        slot.container = container;
    }

    /** ad-এর ওপর আঙুল টেনে স্ক্রল করলে সেই টাচ WebView-তে পাঠায়, যাতে ফিড আটকে না যায়। */
    private static class TouchForwardLayout extends FrameLayout {
        private final View target;
        private final int slop;
        private float downX, downY;
        private boolean forwarding = false;

        TouchForwardLayout(Context ctx, View target) {
            super(ctx);
            this.target = target;
            this.slop = ViewConfiguration.get(ctx).getScaledTouchSlop();
        }

        @Override
        public boolean onInterceptTouchEvent(MotionEvent ev) {
            int action = ev.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                downX = ev.getX();
                downY = ev.getY();
                forwarding = false;
            } else if (action == MotionEvent.ACTION_MOVE && !forwarding) {
                float dy = Math.abs(ev.getY() - downY);
                float dx = Math.abs(ev.getX() - downX);
                if (dy > slop && dy > dx) {
                    forwarding = true;
                    sendToTarget(ev, MotionEvent.ACTION_DOWN);
                    return true;
                }
            }
            return false;
        }

        @Override
        public boolean onTouchEvent(MotionEvent ev) {
            if (!forwarding) return super.onTouchEvent(ev);
            int action = ev.getActionMasked();
            sendToTarget(ev, action);
            if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                forwarding = false;
            }
            return true;
        }

        private void sendToTarget(MotionEvent ev, int action) {
            MotionEvent copy = MotionEvent.obtain(ev);
            copy.setAction(action);
            copy.offsetLocation(getX() - target.getX(), getY() - target.getY());
            target.dispatchTouchEvent(copy);
            copy.recycle();
        }
    }
}
