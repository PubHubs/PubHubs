package nl.pubhubs.client;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Opens Yivi links in the Yivi app, and tells the client when that fails.
 *
 * <p>On Android the Yivi button is a link that looks like this:
 *
 * <pre>intent://qr/json/...#Intent;package=org.irmacard.cardemu;scheme=irma;end</pre>
 *
 * <p>That is not a web address. It is an Android intent written out as text,
 * and everything after {@code #Intent;} says which app to start. Opening it
 * means turning the text back into a real intent first, with
 * {@link Intent#parseUri}.
 *
 * <p>Capacitor does not do that. It passes every outgoing link to the system
 * as "please view this address". For an intent link that asks for a page which
 * does not exist, so no app answers and Android reports that nothing can open
 * it. Capacitor ignores that error, so the button simply appears dead.
 *
 * <p>This plugin fixes that. Capacitor lets a plugin claim a link before it
 * handles the link itself, so we claim the Yivi ones, open them the right way,
 * and send an event to the client if the device has no app that can take them.
 *
 * <p>Only Android uses these intent links; on iOS the Yivi client hands out a
 * normal https link instead.
 */
@CapacitorPlugin(name = "LinkHandler")
public class LinkHandlerPlugin extends Plugin {

    private static final String EVENT_NO_HANDLER = "externalAppMissing";

    /** Package the Yivi app ships under, and the target of its intent links. */
    private static final String YIVI_PACKAGE = "org.irmacard.cardemu";

    /** Custom schemes the Yivi app registers for. */
    private static final List<String> YIVI_SCHEMES = Arrays.asList("irma", "yivi");

    /** Host serving the Yivi universal link, which yivi-client emits for iOS. */
    private static final List<String> YIVI_HOSTS = Arrays.asList("open.yivi.app", "irma.app");

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String scheme = lowercase(url.getScheme());

        // null defers to Capacitor's default policy, which is what every
        // non-Yivi navigation (including the app's own pages) should get.
        if (scheme == null) return null;

        if ("intent".equals(scheme)) return handleIntentLink(url);

        if (YIVI_SCHEMES.contains(scheme)) return launch(new Intent(Intent.ACTION_VIEW, url), url);

        if ("https".equals(scheme) && YIVI_HOSTS.contains(lowercase(url.getHost()))) {
            return launch(new Intent(Intent.ACTION_VIEW, url), url);
        }

        return null;
    }

    private Boolean handleIntentLink(Uri url) {
        Intent intent;
        try {
            intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
        } catch (URISyntaxException e) {
            return null;
        }

        if (!targetsYivi(intent)) return null;

        // An intent link can name any component in any app, so a malicious page
        // could use one to reach parts of an app that were never meant to be
        // opened from outside. Stripping the component and the selector, and
        // requiring the browsable category, limits us to what a browser would
        // also be allowed to open.
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.setComponent(null);
        intent.setSelector(null);

        return launch(intent, url);
    }

    private boolean targetsYivi(Intent intent) {
        if (YIVI_PACKAGE.equals(intent.getPackage())) return true;

        Uri data = intent.getData();
        return data != null && YIVI_SCHEMES.contains(lowercase(data.getScheme()));
    }

    private Boolean launch(Intent intent, Uri url) {
        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            JSObject data = new JSObject();
            data.put("url", url.toString());
            notifyListeners(EVENT_NO_HANDLER, data);
        }

        return true;
    }

    private String lowercase(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }
}
