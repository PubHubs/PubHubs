package nl.pubhubs.client;

import android.graphics.Color;
import android.os.Build;
import android.view.Window;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Gives the status bar and the navigation bar the app's background colour.
 *
 * <p>From Android 15 on, apps are drawn edge to edge and the system bars are
 * transparent. Capacitor's SystemBars keeps the WebView out from under them by
 * padding the window's decor view, so what shows behind the bars is the decor
 * view's background. The page's CSS cannot reach it, so we colour it from here.
 * SystemBars.setStyle resets that background to the theme's window background,
 * so call this after it.
 *
 * <p>Before Android 15 the system paints the bars itself, in the colours the
 * window asks for.
 */
@CapacitorPlugin(name = "SystemBarColor")
public class SystemBarColorPlugin extends Plugin {

    @PluginMethod
    public void setColor(PluginCall call) {
        String value = call.getString("color");
        if (value == null) {
            call.reject("No color given.");
            return;
        }

        int color;
        try {
            color = Color.parseColor(value);
        } catch (IllegalArgumentException e) {
            call.reject("Not a color: " + value);
            return;
        }

        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                getActivity().getWindow().getDecorView().setBackgroundColor(color);
            } else {
                setWindowBarColors(color);
            }
            call.resolve();
        });
    }

    // Deprecated since Android 15, where they no longer do anything; we only
    // call them on older versions.
    @SuppressWarnings("deprecation")
    private void setWindowBarColors(int color) {
        Window window = getActivity().getWindow();
        window.setStatusBarColor(color);
        window.setNavigationBarColor(color);
    }
}
