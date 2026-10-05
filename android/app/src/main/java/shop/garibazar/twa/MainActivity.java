package shop.garibazar.twa;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
