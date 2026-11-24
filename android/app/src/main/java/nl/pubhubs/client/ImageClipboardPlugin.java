package nl.pubhubs.client;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Copies an image to the system clipboard.
 *
 * <p>The web API cannot do this inside an Android WebView. A
 * {@code navigator.clipboard.write()} of an image blob resolves as if it
 * succeeded, but nothing reaches the system clipboard, so there is never
 * anything to paste and never an error to report either.
 *
 * <p>Android copies an image by reference rather than by value: the clipboard
 * carries a content:// URI, and the system grants whichever app reads the clip
 * temporary permission to read it. So we write the bytes into our cache, publish
 * them through the FileProvider that AndroidManifest.xml already declares, and
 * put that URI on the clipboard.
 */
@CapacitorPlugin(name = "ImageClipboard")
public class ImageClipboardPlugin extends Plugin {

    /** Matches the authorities of the FileProvider in AndroidManifest.xml. */
    private static final String FILE_PROVIDER_SUFFIX = ".fileprovider";

    /** A single reused file: only one image can be on the clipboard at a time. */
    private static final String CACHE_PATH = "clipboard/image.png";

    @PluginMethod
    public void copyImage(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("No image data given.");
            return;
        }

        try {
            Uri uri = publish(Base64.decode(data, Base64.DEFAULT));

            // newUri asks the resolver for the MIME type, which the FileProvider
            // derives from the .png extension, so pasting apps see an image.
            ClipData clip = ClipData.newUri(getContext().getContentResolver(), "Image", uri);
            clipboardManager().setPrimaryClip(clip);

            call.resolve();
        } catch (IllegalArgumentException e) {
            call.reject("Image data is not valid base64.", e);
        } catch (IOException e) {
            call.reject("Could not write the image to the cache.", e);
        }
    }

    /** Writes the bytes into the cache and returns a URI others may read. */
    private Uri publish(byte[] image) throws IOException {
        File file = new File(getContext().getCacheDir(), CACHE_PATH);

        File directory = file.getParentFile();
        if (directory != null && !directory.exists() && !directory.mkdirs()) {
            throw new IOException("Could not create " + directory);
        }

        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(image);
        }

        return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + FILE_PROVIDER_SUFFIX, file);
    }

    private ClipboardManager clipboardManager() {
        return (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
    }
}
