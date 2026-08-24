package nl.pubhubs.client.push;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.SuppressLint;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import nl.pubhubs.client.MainActivity;
import nl.pubhubs.client.R;

/**
 * Shows a generic "you have new messages" system notification that opens the app on the right
 * hub. This is the fallback path a push transport's Service (FcmService / UnifiedPushService)
 * always takes in addition to {@link PushEvents}: when Android starts this process purely to
 * deliver a push, there may be no WebView/Activity/plugin around at all to relay a JS event to,
 * so this is the only way the user finds out.
 *
 * <p>The notification carries only the opaque {@code hub_id} and a fixed, generic string - never
 * message content, sender, or room information - matching the payload contract described in the
 * push notifications plan.
 */
public final class LocalNotifier {

    private static final String CHANNEL_ID = "pubhubs_push";

    private LocalNotifier() {}

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.push_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        );
        // createNotificationChannel is a no-op if a channel with this id already exists, so this
        // is safe (and cheap enough) to call every time rather than tracking whether it ran once.
        manager.createNotificationChannel(channel);
    }

    // Lint's static MissingPermission check for POST_NOTIFICATIONS can't see that
    // areNotificationsEnabled() already proves it's safe to call notify() below.
    @SuppressLint("MissingPermission")
    public static void showHubActivity(Context context, String hubId) {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);

        // On API 33+ posting a notification without POST_NOTIFICATIONS granted throws; on older
        // APIs the permission doesn't exist and this is unconditionally true. Silently doing
        // nothing here is correct: PushEvents.notifyPushReceived (also called by the Service) is
        // the only other delivery path, and if the user denied the permission there is no UI to
        // fall back to anyway.
        if (!notificationManager.areNotificationsEnabled()) return;

        ensureChannel(context);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(MainActivity.EXTRA_PUSH_HUB_ID, hubId);

        int requestCode = hubId.hashCode();

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // TODO: ic_launcher is the full-colour app icon, not the plain white silhouette Android's
        // notification guidelines call for - it will render oddly (often as a white square/dot)
        // on some OS versions. Replace with a dedicated monochrome vector drawable before shipping.
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(context.getString(R.string.push_notification_title))
            .setContentText(context.getString(R.string.push_notification_body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        notificationManager.notify(requestCode, builder.build());
    }
}
