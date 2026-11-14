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
            GariFcmService.cancelTray(getContext());
        } catch (Throwable t) {
            // ignore
        }
        call.resolve();
    }

    @PluginMethod
    public void setCount(PluginCall call) {
        try {
            Integer n = call.getInt("count", 0);
            GariFcmService.setBadge(getContext(), n == null ? 0 : n);
        } catch (Throwable t) {
            // ignore
        }
        call.resolve();
    }
}
