# The app

The Android and iOS app is a [Capacitor](https://capacitorjs.com) shell around the global client,
with the hub client bundled inside it. This page covers how it fits together, running it during
development, its native behaviour, releasing it, and review mode for the app stores.

More detail:

- [Hub isolation](hub-isolation.md): how the app keeps hubs apart from the shell and from each
  other, and the [iOS test plan](ios-isolation-test.md) for it.
- [Offline](offline.md): how the app keeps working without a connection.

## How it fits together

- **The shell** is the global client, built with `npm run build:global:native` and served by
  Capacitor from `https://pubhubs-app.invalid` (Android) or `capacitor://pubhubs-app.invalid`
  (iOS). `.invalid` is reserved, so no web page can ever have this origin.
- **The hub client** is bundled under `/hub/` (`npm run build:hub:native`) instead of loaded from
  each hub's own domain. Every hub gets its own origin, `<label>.hubs.pubhubs-app.invalid`, with the
  label derived from the hub ID; see [Hub isolation](hub-isolation.md). The shell gives a hub frame
  its server (`HUB_URL`) and the shell's origin (`PARENT_URL`) in the frame's query string.
- **The configuration** is `client-config.js`, as on the web. It only names PubHubs Central
  (`PHC_URL`) and the global client (`PUBHUBS_URL`); everything else, such as the hubs and the Yivi
  server, comes from PubHubs Central.
- **The app ID** is `net.pubhubs.app` on Android and iOS. The Java package stays
  `nl.pubhubs.client`, which doesn't need to match.
- **Native code** is small: `android/app/src/main/java/nl/pubhubs/client/` has `MainActivity`
  (the back gesture, hub origins, debug settings), `HubOriginWebViewClient` (serves the hub
  origins), and the plugins `LinkHandler` (opens Yivi), `SystemBarColor` and `ImageClipboard`.

## Running it during development

Start PubHubs as in [Development](../development.md), then:

```sh
npm run cap:run:android    # build both clients, sync, and run on a connected device
npm run cap:run:ios        # the same for iOS (Xcode, on a Mac)
```

`cap:sync:android` / `cap:sync:ios` build and sync without running, and `cap:open:android` /
`cap:open:ios` open Android Studio or Xcode. `mask run android ...` and `mask run ios ...` wrap
these (`build`, `copy`, `sync`, `update`, `open`, `run`, `doctor`, and `log` for Android); `copy`
doesn't rebuild the hub client, so after a hub client change it serves a stale `/hub/`.

**Reaching your computer.** A phone can't reach `localhost` on your computer, and PubHubs Central
hands out hub addresses on your computer's network address anyway (the `networkhost` in
`pubhubs.toml`). So the app uses that address too:

- `scripts/sync-networkhost-ip.js` runs before every build. It writes the address to the
  gitignored `capacitor.config.local.json`, which adds it to Capacitor's `allowNavigation`, and
  generates the gitignored `ios/App/App/Info.plist` from `Info.template.plist`, with an App
  Transport Security exception for it (one entry covers every port).
- For iOS, `scripts/patch-ios-client-config-ip.js` also puts that address in the built
  `global-client/dist/client-config.js`.
- On Android, `mask run android ports` forwards the phone's own `localhost` ports to your computer
  over USB, for the browser on the phone.
- Yivi needs developer mode to accept plain HTTP; see
  [Logging in with Yivi](../development.md#logging-in-with-yivi).

**Debug and release builds.** Development uses plain HTTP. Debug builds allow that: the shell is an
`https://` page, so `MainActivity` allows mixed content in debug builds only, and the debug
manifest allows cleartext traffic. Release builds allow neither (see
[Release builds](#release-builds)).

**Debugging.** Debug builds can be inspected with `chrome://inspect` in Chrome (Android) or Safari's
Web Inspector (iOS). Where `chrome://inspect` doesn't work, as on GrapheneOS, use
`scripts/devtools-origin-proxy.mjs`; its header explains how. `window.pubhubsSimulateOffline(...)`
in a debug build's console makes servers look unreachable; see [Offline](offline.md#testing).

**Icons** are generated from `resources/icon.svg` with `npm run generate:icons`.

## Native behaviour

- **Yivi.** On a phone the Yivi widget shows a button instead of a QR code. The `LinkHandler`
  plugin opens the Yivi app for it, and reports a missing Yivi app to the login page. Yivi doesn't
  return to PubHubs by itself; the user switches back.
- **System bar colours (Android 15 and later).** The bars are transparent, and Capacitor's
  `SystemBars` keeps the WebView out from under them by padding the window's decor view, so the
  decor view's background shows behind them. `SystemBars.setStyle` resets that background to the
  theme's grey window background, so `App.vue` calls `setStyle` first and then the `SystemBarColor`
  plugin, which colours the decor view with the app's `--surface-background`. Before Android 15
  the plugin sets the window's bar colours instead. The bars follow the app's theme, including the
  system setting.
- **The back gesture.** Capacitor only handles it with its App plugin, which we don't use.
  `MainActivity` goes back in the WebView's history first (from the register page to the login
  page, say, or inside a hub), and only leaves the app when there is nothing left to go back to.
- **The logo** on the login and register pages goes to the login page, not to `PUBHUBS_URL`, which
  would leave the app.

## What hubs need for the app

- **A hub only answers the app's hub origins from a release with
  `pubhubs_hub/modules/pubhubs/_native_app.py`.** That module adds the hub's two app origins
  (`https://` and `capacitor://` `<label>.hubs.pubhubs-app.invalid`) to `allowed_origins`, once the
  hub knows its own ID from PubHubs Central.
- **On an older hub, only the Matrix API works in the app.** Synapse allows any origin there, so
  joining rooms and chatting work, but consent, hub settings, secured rooms and the other PubHubs
  endpoints are blocked by CORS. In JavaScript that looks exactly like being offline.
- **The house rules fail closed.** When the consent check fails that way and the hub has no earlier
  answer on the device, the hub client asks for consent instead of letting the user in (see
  [Offline](offline.md)). Saving the consent fails too, so the user can't get in until the hub is
  updated.
- So external hubs have to update to a release with app support before their users can use them in
  the app. We still have to decide whether the app should check `hub_version` from `.ph/info` and
  say so, instead of looking offline.

## Release builds

Release builds talk to production, using the committed
`global-client/config/client-config.production.js`. It's in the repository because F-Droid builds
the app from our source.

- `npm run cap:sync:android:release` builds the clients with that config and syncs them into
  `android/`. It sets `PUBHUBS_RELEASE`, so `capacitor.config.ts` turns off cleartext traffic and
  ignores `capacitor.config.local.json`.
- Then, in `android/`, `./gradlew bundleRelease` builds the app bundle for the Play Store (in
  `app/build/outputs/bundle/release/`), and `./gradlew assembleRelease` the APK (in
  `app/build/outputs/apk/release/`).
- **Signing:** set `PUBHUBS_KEYSTORE` (an absolute path), `PUBHUBS_KEYSTORE_PASSWORD`,
  `PUBHUBS_KEY_ALIAS` and `PUBHUBS_KEY_PASSWORD`. Without them the release build is unsigned, which
  is what F-Droid expects; it signs with its own key.
- **Version:** set `versionCode` and `versionName` in `android/app/build.gradle` on every release
  (the merge-to-stable template has the step); F-Droid reads them from there.
  - `versionName` is the release version without the `v`, for example `3.6.0`.
  - `versionCode` is `MAJOR * 10000 + MINOR * 100 + PATCH`, for example `30600`. Play only accepts
    a version code once, and it has to go up.
  - Release candidates (`-rc0`) usually share the commit, and so the version code, with the final
    release. Only upload final releases to Play; share release candidates as an APK or through
    Play's internal app sharing, which doesn't need a new version code.

### CI

- **`build-android`** runs on a final release tag (`vX.Y.Z`). It builds the signed app bundle and
  APK and keeps them as job artifacts; upload the bundle to Play by hand. It runs in the
  `android-build` image from `ilab/docker-build`, fails when `versionName`/`versionCode` don't
  match the tag, and signs with the upload key from the protected CI variables
  `PUBHUBS_KEYSTORE_BASE64` (the keystore, base64-encoded), `PUBHUBS_KEYSTORE_PASSWORD`,
  `PUBHUBS_KEY_ALIAS` and `PUBHUBS_KEY_PASSWORD`. Release tags have to be protected to get them.
- **`android-build-check`** builds the app unsigned in merge requests and on main, whenever
  something it depends on changed (`android/`, `capacitor.config.ts`, the npm package files,
  `global-client/config/`, the CI file), so a broken app build shows up before the release tag.
- **GitHub:** our [GitHub mirror](https://github.com/PubHubs/PubHubs) gets the same tags, and its
  `.github/workflows/android-release.yml` builds a signed APK there for people who don't use a
  store. It puts the APK, its `SHA256SUMS` and a build provenance attestation in a **draft**
  release, with the version's part of `CHANGELOG.md` as notes (GitLab CI's `changelog-release-check`
  fails already on the `-rc0` tag when that part is missing); someone publishes it by hand. It signs
  with GitHub secrets of the same names. To test the app, run that workflow by hand from GitHub's
  Actions tab on any branch, with a version like `3.6.0-test.1`: it builds that branch into a GitHub
  **pre-release** under the tag `v3.6.0-test.1`, which it makes on GitHub only. Don't push such a
  tag to GitLab, whose CI deploys stable on any tag.

### Play Store

- The app uses Play App Signing: Google keeps the key that signs what users install, and we sign
  what we upload with our upload key (alias `upload`, `O=Privacy by Design Foundation`). It is in
  the team's password manager, and in the CI variables and GitHub secrets above. A lost or leaked
  upload key can be reset through Play support.
- A new upload key: `keytool -genkeypair -keystore pubhubs-upload.jks -storetype PKCS12 -alias
  upload -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=PubHubs, O=Privacy by Design
  Foundation, C=NL"`. With PKCS12, the keystore and the key have the same password.
- Uploading is by hand, with the bundle from `build-android`. The first upload went to the internal
  testing track, with version code 1.
- Installs from Play, F-Droid and GitHub have different signatures (Google's key, F-Droid's key, our
  upload key), so users can't move from one to another without reinstalling. Android app links
  (`assetlinks.json`) need the fingerprints of Google's app signing key (in Play Console under App
  integrity) and of F-Droid's key, not the upload key.

## Review mode

App store reviewers can't log in with a real Yivi identity, so the app has a hidden switch to a
separate environment where they register with Yivi demo credentials.

- **Switching on:** tap the mascot on the login page ten times in quick succession, and confirm.
  The app clears the session and the hub list on the device, and reloads on the register page.
- **Switching off:** the "Review environment" bar under the header of the login and register pages
  has a "Leave" button. Logging out doesn't leave review mode, because the app also logs out by
  itself, for example when a session expires.
- **Which environment:** `REVIEW_PHC_URL` in `client-config.production.js`; for now main
  (`https://phc-main.pubhubs.net`). While the `ph:review-mode` key is set in `localStorage`, that
  file sets `PHC_URL` to it before any module loads.
- **Where:** only in the native app, and only with a `REVIEW_PHC_URL` configured, so not in
  development or on the web. The code is in `global-client/src/logic/reviewMode.ts`.
- The demo email address the reviewers use is effectively their password: anyone can issue
  themselves Yivi demo credentials with the same value. Keep it long and random, and only give it
  to the store.

Setting up for a review:

1. **The reviewer account.** Register it yourself, in the app in review mode, with the demo email
   address and phone number, before the review starts. Reviewers then log in on several devices
   with the same identity; two first registrations at the same time could each create their own
   user secret.
2. **Admin rights.** Enter the hub with that account, note its pseudonym, and make it admin on main
   as in [Making yourself admin](../development.md#making-yourself-admin): on `ph.ihub.ru.nl`,
   `docker exec -it testhub-matrix-main sudo -u postgres psql hub` and
   `UPDATE users SET admin = 1 WHERE name = '@xxx-xxx:main.testhub-matrix.ihub.ru.nl';`, then
   restart the hub. Anyone with the demo email address gets these rights too, so a separate hub for
   the review is safer than main's Testhub.
3. **Play Console**, under App access: how to add the demo credentials in Yivi; open PubHubs and tap
   the mascot ten times; confirm; tap "Register with Yivi" and approve in Yivi; switch back to
   PubHubs by hand; on a general error, try once more.
4. Main's hubs must have app support (see [What hubs need for the app](#what-hubs-need-for-the-app)).

## Testing against main

- **With review mode**, which is in every release build: `npm run cap:sync:android:release`, then
  `./gradlew installDebug` in `android/` (in `nix develop`), and tap the mascot ten times.
- **A build that starts on main:** run `npm run build:native:release`, replace
  `global-client/dist/client-config.js` with a config with
  `PUBHUBS_URL: 'https://main.pubhubs.ihub.ru.nl'` and `PHC_URL: 'https://phc-main.pubhubs.net'`,
  then `PUBHUBS_RELEASE=1 npx cap sync android` and install. `dist/` isn't committed, so nothing
  changes in the repository.

## Known gaps

- **Video calls on a real device** don't work in development: the test hubs give the browser
  `LIVEKIT_URL` as `http://localhost:<port>`, which a phone can't reach.
- **The iOS native bridge** is reachable from hub frames; see
  [Hub isolation](hub-isolation.md#known-gaps).
- **iOS release builds** keep the development App Transport Security exceptions from
  `Info.template.plist` (`NSAllowsLocalNetworking` and the networkhost address), since nothing
  removes them for release yet.
