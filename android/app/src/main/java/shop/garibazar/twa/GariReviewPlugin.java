package shop.garibazar.twa;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

@CapacitorPlugin(name = "GariReview")
public class GariReviewPlugin extends Plugin {
    @PluginMethod
    public void request(PluginCall call) {
        try {
            final ReviewManager manager = ReviewManagerFactory.create(getContext());
            manager.requestReviewFlow().addOnCompleteListener(task -> {
                try {
                    if (task.isSuccessful() && getActivity() != null) {
                        ReviewInfo info = task.getResult();
                        manager.launchReviewFlow(getActivity(), info)
                                .addOnCompleteListener(t2 -> call.resolve());
                    } else {
                        call.resolve();
                    }
                } catch (Throwable t) {
                    call.resolve();
                }
            });
        } catch (Throwable t) {
            call.resolve();
        }
    }
}
