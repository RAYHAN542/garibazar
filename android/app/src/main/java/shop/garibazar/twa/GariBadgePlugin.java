package shop.garibazar.twa;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GariBadge")
public class GariBadgePlugin extends Plugin {
    @PluginMethod
    public void clear(PluginCall call) {
        try {
            GariFcmService.resetBadge(getContext());
        } catch (Throwable t) {
            // ignore
        }
        call.resolve();
    }
}
