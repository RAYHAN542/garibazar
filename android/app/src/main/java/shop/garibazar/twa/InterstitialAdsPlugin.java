package shop.garibazar.twa;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

/**
 * Full-screen Interstitial (video) ad. load() আগে থেকে ad রেডি করে রাখে,
 * show() সেটা দেখায় এবং ad বন্ধ/skip হলে resolve করে।
 * কোনো কিছুই reject করে না, যাতে ad-এর ভুলে অ্যাপের ভিডিও ফিড কখনো আটকে না যায়।
 * Skip button কখন আসবে তা AdMob/Google নিজে ঠিক করে।
 */
@CapacitorPlugin(name = "InterstitialAds")
public class InterstitialAdsPlugin extends Plugin {

    private InterstitialAd interstitial;
    private boolean loading = false;

    @PluginMethod
    public void load(PluginCall call) {
        final String adUnitId = call.getString("adUnitId");
        final JSObject ret = new JSObject();
        if (adUnitId == null) {
            ret.put("loaded", false);
            ret.put("error", "adUnitId is required");
            call.resolve(ret);
            return;
        }
        if (interstitial != null) {
            ret.put("loaded", true);
            call.resolve(ret);
            return;
        }
        if (loading) {
            ret.put("loaded", false);
            call.resolve(ret);
            return;
        }
        loading = true;
        getActivity().runOnUiThread(() ->
            InterstitialAd.load(
                getContext(),
                adUnitId,
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(InterstitialAd ad) {
                        interstitial = ad;
                        loading = false;
                        JSObject r = new JSObject();
                        r.put("loaded", true);
                        call.resolve(r);
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        interstitial = null;
                        loading = false;
                        JSObject r = new JSObject();
                        r.put("loaded", false);
                        r.put("error", error.getCode() + " " + error.getMessage());
                        call.resolve(r);
                    }
                }
            )
        );
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            final InterstitialAd ad = interstitial;
            if (ad == null) {
                JSObject r = new JSObject();
                r.put("shown", false);
                call.resolve(r);
                return;
            }
            interstitial = null; // একটা ad একবারই দেখানো যায়
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    JSObject r = new JSObject();
                    r.put("shown", true);
                    call.resolve(r);
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    JSObject r = new JSObject();
                    r.put("shown", false);
                    call.resolve(r);
                }
            });
            ad.show(getActivity());
        });
    }
}
