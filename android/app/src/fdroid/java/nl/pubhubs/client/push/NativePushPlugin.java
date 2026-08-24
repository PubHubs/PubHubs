package nl.pubhubs.client.push;

import android.Manifest;
import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.unifiedpush.android.connector.UnifiedPush;

import java.util.List;

/**
 * fdroid flavor: registers for push via UnifiedPush instead of Firebase (this build has no
 * Google Play Services dependency at all - see the push notifications plan). Needs a UnifiedPush
 * distributor app (e.g. ntfy) already installed on the device; unlike FCM this doesn't just work
 * out of the box for most users, hence the explicit "no_distributor" unavailable reason below.
 *
 * <p>Exposed to JS under the same plugin name ("NativePush") and event contract as the gplay
 * flavor's FCM-based implementation and the iOS APNs implementation, so
 * global-client/src/logic/nativePush.ts stays platform (and flavor) agnostic. This flavor reports
 * {@code transport: "unifiedpush"} and hands JS the UnifiedPush endpoint URL as the "token" -
 * that URL is registered directly as the Matrix pusher's {@code data.url}, since a hub's Sygnal
 * instance can send to it directly via its webpush pushkin (see the push notifications plan).
 *
 * <p>NEEDS VERIFICATION (no Android SDK in this sandbox to build against, and no network access
 * to check org.unifiedpush.android:connector's current docs for the version pinned in
 * variables.gradle): the org.unifiedpush.android.connector.UnifiedPush API surface used below
 * (register/getDistributors/saveDistributor/getAckDistributor) is written from best recollection
 * of the connector library's v2.x contract, not confirmed against its actual source or docs.
 * Cross-check against https://unifiedpush.org/developers/android/ before relying on this - this
 * is exactly the "spike this early" risk flagged in the push notifications plan.
 */
@CapacitorPlugin(
    name = "NativePush",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
    }
)
public class NativePushPlugin extends Plugin {

    /** Only one Matrix pusher's worth of push is needed per device. */
    private static final String INSTANCE = "default";

    @Override
    public void load() {
        super.load();
        PushEvents.setActivePlugin(this);
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (getPermissionState("receive") != PermissionState.GRANTED) {
            requestPermissionForAlias("receive", call, "registerPermissionCallback");
            return;
        }
        registerWithDistributor(call);
    }

    @PermissionCallback
    private void registerPermissionCallback(PluginCall call) {
        if (getPermissionState("receive") == PermissionState.GRANTED) {
            registerWithDistributor(call);
        } else {
            PushEvents.notifyUnavailable("permission_denied");
            call.resolve();
        }
    }

    private void registerWithDistributor(PluginCall call) {
        Context context = getContext();

        String saved = UnifiedPush.getAckDistributor(context);
        if (saved == null) {
            List<String> distributors = UnifiedPush.getDistributors(context);
            if (distributors.isEmpty()) {
                // The common case on a mainstream, non-de-Googled phone: no UnifiedPush
                // distributor installed. Unlike FCM, this doesn't "just work" - the JS layer
                // should surface a "install a push provider (e.g. ntfy)" prompt for this reason.
                PushEvents.notifyUnavailable("no_distributor");
                call.resolve();
                return;
            }
            // TODO: if there's more than one, this should let the user choose rather than
            // silently picking the first - a UI gap, not a blocker for this first version.
            UnifiedPush.saveDistributor(context, distributors.get(0));
        }

        // The endpoint URL itself arrives asynchronously via UnifiedPushService.onNewEndpoint, not
        // as a return value here - same fire-and-forget shape as the gplay/iOS implementations.
        UnifiedPush.register(context, INSTANCE);
        call.resolve();
    }
}
