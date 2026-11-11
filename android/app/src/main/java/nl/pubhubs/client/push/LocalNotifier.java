package nl.pubhubs.client.push;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import nl.pubhubs.client.MainActivity;
import nl.pubhubs.client.R;

/**
 * Shows the generic "You have new messages" notification for a push; tapping it opens the app on
 * the hub of the latest push. Pushes are data only on Android (FCM and UnifiedPush alike), so this
 * is how the user sees them. The notification shows nothing about the hub or the message.
 */
public final class LocalNotifier {

    private static final String CHANNEL_ID = "pubhubs_push";

    /**
     * One notification for all pushes: a new push replaces it. The sealed tag differs on every push,
     * and the notification doesn't name the hub anyway.
     */
    private static final int NOTIFICATION_ID = 1;

    private LocalNotifier() {}

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        // A no-op when the channel exists.
        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.push_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        ));
    }

    // areNotificationsEnabled() covers the POST_NOTIFICATIONS check, which lint can't see.
    @SuppressLint("MissingPermission")
    public static void show(Context context, String sealedTag) {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        if (!notificationManager.areNotificationsEnabled()) return;

        ensureChannel(context);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(MainActivity.EXTRA_PUSH_TAG, sealedTag);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // TODO: a monochrome notification icon; the full-colour launcher icon shows as a blob on
        // some Android versions.
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(context.getString(R.string.push_notification_title))
            .setContentText(context.getString(R.string.push_notification_body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }
}
