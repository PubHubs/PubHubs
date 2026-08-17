# Specific info for developing the App

## Real-device testing: why `localhost` doesn't work, and what replaces it

For real-device testing (a real iPhone or Android phone, not the iOS Simulator), a device can't reach
`localhost` on the dev machine — there's no route to it. This works fine in the iOS Simulator, which
shares the Mac's network, so `localhost` resolves to the dev machine there; on a real Android device
Android's `adb reverse` (see `mask run android ports`) tunnels the phone's own `localhost` back to the
Mac over USB, and there's no iOS equivalent. So real-device dev URLs need to use the dev machine's LAN
IP instead — `pubhubs/pubhubs.toml`'s `[host_aliases] networkhost.ip` (or the
`networkhost.source_ip_for` auto-detect default in `pubhubs.default.toml`) — not `localhost`.

Two different fixes apply this, to two different legs of the app, for two different reasons:

### PHC / global-client: LAN IP over plain HTTP

PHC hands out hub/MSS URLs built from the `networkhost` alias already. `global-client`'s own
`PUBHUBS_URL`/`PHC_URL` need to request that same IP — otherwise the app never even attempts the
address that's been made reachable. This alone is enough here: global-client never uses
`window.crypto.subtle`, and a plain-HTTP *parent* frame embedding an HTTPS *child* iframe (see below)
triggers no browser restriction — only the reverse direction does.

- `ios/App/App/Info.plist` has a matching ATS exception domain keyed on that IP.
- The tracked `global-client/public/client-config.js` keeps its defaults — device-specific overrides go
  in the gitignored `global-client/public/client-config.local.js` instead (loaded after the tracked file
  in `global-client/index.html`, so it can override individual `_env` keys). Those overrides are wrapped
  in a native-platform check (`window.androidBridge` / `window.webkit.messageHandlers.bridge` — the raw
  markers Capacitor's own `getPlatform()` checks internally, present before any page script runs), so
  they're a no-op in any browser context — this dev machine, the iOS Simulator, or adb-forwarded Android
  browser testing, all of which already reach the app fine over plain `localhost` — and only take effect
  inside the native Capacitor shell on a real device, which is the one case that actually needs the LAN
  IP. This means a stale (or freshly regenerated) `client-config.local.js` can no longer break
  browser-based dev, whatever IP it happens to hold.

Both are kept in sync automatically by `scripts/sync-networkhost-ip.js` — `pubhubs.toml` is the source
of truth they're generated from. `npm run sync:networkhost-ip` (at the repo root) does this, and it also
runs automatically before `cap:sync`, `cap:run:ios`, and `cap:open:ios`, so there's normally nothing to
do by hand.

### hub-client / Matrix API: LAN IP over locally-trusted HTTPS, via a dev proxy

The hub-client SPA — the actual iframe content, `hub_client_url` from `pubhubs_hub/start_testhub.py` —
needs the same LAN-IP treatment to be *reachable*, but plain HTTP isn't enough here: hub-client uses
`window.crypto.subtle` for E2E room encryption
(`hub-client/src/composables/useRoomLibrary.ts`), and browsers only expose that in a "secure context" —
`https://` or `localhost`, never plain `http://<lan-ip>`. Once hub-client's own page is HTTPS, its
`fetch`/XHR calls to the Matrix/Synapse API would in turn be blocked as mixed content unless that's
HTTPS too.

The fix: `mask run proxy` runs a local [Caddy](https://caddyfile.dev) reverse proxy, terminating TLS
with a cert from [`mkcert`](https://github.com/FiloSottile/mkcert) (a locally-trusted CA — trusted
everywhere the CA is installed, see below), fronting:

- `https://<networkhost-ip>:{8001+n+10000}` → hub-client's own Vite dev server on `127.0.0.1:{8001+n}`
  (this is `hub_client_url`, computed in `start_testhub.py`).
- `https://<networkhost-ip>:{8008+n+10000}` → the Matrix/Synapse API on `127.0.0.1:{8008+n}` (this is
  hub-client's `HUB_URL`, set via `VITE_HUB_URL` in `maskfile.md`'s "hub client (n)" task).

These are *additional*, new ports (existing port + 10000) — not a replacement. PHC and yivi keep talking
to each hub over the existing plain-HTTP `networkhost` ports exactly as configured in
`pubhubs/pubhubs.toml`; only the browser-facing addresses above changed. `scripts/gen-dev-proxy.js`
(run automatically by `mask run proxy`) regenerates the cert and `Caddyfile.local` whenever the
networkhost IP changes, the same way `sync-networkhost-ip.js` does for Info.plist/client-config.local.js.

**`mask run proxy` needs to be running for any hub to load, on every platform** — `mask run all` starts
it automatically; if you're running `mask run hub server`/`hub client` by hand instead, start
`mask run proxy` too.

**Trust the `mkcert` CA** — each of these has its own separate trust store, so all four are needed
independently:

- **Dev Mac (browser dev)**: `mkcert -install` once. This installs the CA into the macOS system
  keychain (and Firefox's own store) — it does **not** reach the iOS Simulator, which has a separate
  keychain of its own (see next).
- **iOS Simulator**: has its own keychain, unaffected by `mkcert -install`. Boot the Simulator, then run
  `npm run trust:ios-simulator` (wraps `xcrun simctl keychain <udid> add-root-cert`) — this is also run
  automatically as part of `cap:run:ios`/`cap:open:ios`, but only takes effect on Simulators that are
  *already* booted at that point, so run it by hand after first booting a new Simulator instance.
  Without this you'll see WKWebView cert errors ("*Het certificaat van deze server is ongeldig* …") for
  every HTTPS request through the dev proxy.
- **Real iPhone**: same underlying error as the Simulator ("*Het certificaat van deze server is
  ongeldig* …"), but there's no `simctl`-equivalent automation for a real device — this is fully manual:
  1. Get `$(mkcert -CAROOT)/rootCA.pem` onto the phone. Easiest from a Mac: `open -R "$(mkcert -CAROOT)/rootCA.pem"`
     to reveal it in Finder, then right-click → Share → AirDrop → the iPhone. (Email/Files/AirDrive work
     too if AirDrop isn't available.)
  2. Tap the file on the iPhone → it opens Settings with "Profile Downloaded" → Settings → General →
     **VPN & Device Management** → tap the profile → **Install** (enter passcode) → **Install** again to
     confirm.
  3. Separate step, easy to miss: Settings → General → About → **Certificate Trust Settings** → toggle
     full trust **on** for the mkcert root cert. Installing the profile alone is not enough.
  4. Relaunch the app on the device.

  One-time per physical device — you won't need to repeat it unless the mkcert CA itself is regenerated
  (only happens if `~/Library/Application Support/mkcert` is deleted; routine `networkhost.ip` changes
  only regenerate the *leaf* cert via `scripts/gen-dev-proxy.js`, not the CA).
- **Real Android phone**: transfer `$(mkcert -CAROOT)/rootCA.pem` to the device and install it via
  Settings → Security → Encryption & Credentials → Install a certificate → CA certificate.

The two real-device steps can't be automated over the network or USB without MDM — one-time per
physical test device, not per session. The Simulator step is scripted but still needs a human to run it
once per Simulator instance (there's no reliable hook to catch "a new Simulator just booted").

## Older WKWebView on a real device: missing JS features

A real device may be running an older iOS/WKWebView version than the Simulator (which tracks whatever
Xcode ships) or a desktop browser (which auto-updates), so it can be missing very recent JS engine
features that a dependency assumes exist. First one hit: `matrix-js-sdk` uses `Promise.withResolvers()`
(Safari 17.4+) pervasively (`scheduler.js`'s `queueEvent`, `client.js`, `sync.js`,
`interactive-auth.js`, and more) — on an older WKWebView, sending a message throws
`Promise.withResolvers is not a function` with no visible error in the UI, only in Safari Web
Inspector's console. Fixed with a small polyfill,
`hub-client/public/polyfill-promise-with-resolvers.js`, loaded as a plain script (like
`client-config.js` in the same `index.html`) so it always runs before any bundled code, regardless of
import order — a no-op wherever the native implementation already exists. If another such gap turns up,
the same pattern (a plain public script, unbundled, loaded first) is the fix.

## Known follow-ups, out of scope here

- **LiveKit (video calls) is not fronted by the dev proxy.** `_video_call_web.py` hands the browser the
  very same `LIVEKIT_URL` it uses for its own server-side LiveKit API calls (see
  `docs/development/VIDEO_CALL_TROUBLESHOOTING.md`), so giving the browser a different (HTTPS) address
  would first require separating those two uses — a real device may hit mixed-content blocking on a
  video call once hub-client's own page is HTTPS. Basic hub loading/navigation and E2E room encryption
  are unaffected.
- `ios/App/App/Info.plist` has no `NSLocalNetworkUsageDescription` key. If testing on an RFC1918 private
  LAN (as opposed to a routable IP), iOS 14+'s Local Network Privacy permission prompt applies and could
  silently block connections on a real device without it.
- `pubhubs/pubhubs.toml`'s `[host_aliases] networkhost.ip` is a manually-pinned value; if it doesn't
  match the Wi-Fi network the dev Mac is currently on, everything above will point at a stale/unreachable
  IP — update it and re-run `mask run proxy` / `npm run cap:sync`.
- See also `docs/development/LOCAL_DEVELOPMENT.md` for the separate Apple Private Relay / Yivi Local
  Network permission pitfalls on real iOS devices.
