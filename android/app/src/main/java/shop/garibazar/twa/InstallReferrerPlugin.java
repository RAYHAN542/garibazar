package shop.garibazar.twa;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Reads the Google Play Install Referrer (the `referrer=` value that was in the
// Play Store link the user came from) so the first-open install event can say
// whether it came from the website button, a Facebook ad, or organic search.
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    @PluginMethod
    public void getReferrer(final PluginCall call) {
        final JSObject result = new JSObject();
        try {
            final InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    try {
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            ReferrerDetails details = client.getInstallReferrer();
                            String ref = details.getInstallReferrer();
                            result.put("referrer", ref == null ? "" : ref);
                        }
                    } catch (Exception ignored) {
                        // fall through with empty result
                    } finally {
                        try {
                            client.endConnection();
                        } catch (Exception ignored) {
                        }
                        call.resolve(result);
                    }
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    // nothing to do; JS side has its own timeout
                }
            });
        } catch (Exception e) {
            call.resolve(result);
        }
    }
}
