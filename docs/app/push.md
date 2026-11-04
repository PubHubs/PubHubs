# Push notifications

When the app is closed, a new message in a hub shows the notification "You have new messages". Tapping
it opens that hub. The notification never says which hub, room, sender or message it's about.

## How a push travels

```
app ──pusher (random pushkey, blob)──▶ hub

hub's Synapse ─▶ hub's push gateway   (sends on only the blob)
              ─▶ transcryptor          (knows the hub, can't read the blob)
              ─▶ PHC                   (reads the blob, doesn't know the hub)
              ─▶ Apple / Google / UnifiedPush server ─▶ device: {tag} ─▶ app opens the hub
```

- **The app** gets a push token from its platform: APNs on iOS, FCM in the Android `gplay` build,
  or a UnifiedPush endpoint with Web Push keys in the `fdroid` build. For every hub it's logged in
  to, it registers a Matrix pusher with a random pushkey and, in the pusher's data, a **blob**: the
  token and a random per-hub **tag**, encrypted for PHC (`global-client/src/logic/pushBlob.ts`).
  Each blob is encrypted afresh, so two hubs never get the same one. The app keeps the tag → hub
  map to itself (`global-client/src/logic/nativePush.ts`).
- **The hub's push gateway** (`pubhubs_hub/modules/pubhubs/_push_gateway_proxy.py`, at
  `_matrix/push/v1/notify` on the hub) gets Synapse's notifications and sends on only the blobs, to
  the transcryptor's `.ph/push`. Hubs need no configuration and hold no push credentials.
- **The transcryptor** passes the blobs to PHC's `.ph/push/send`, sealed with the secret only it and
  PHC have, so PHC doesn't learn which hub they come from.
- **PHC** (`pubhubs/src/servers/phc/push.rs`) decrypts each blob and sends the push, with Apple's
  and Google's credentials or, for UnifiedPush, Web Push encrypted for the device and signed with
  PHC's VAPID key. The push carries only the tag. If a token is no longer valid, PHC says so, and
  the hub's Synapse deletes the pusher.

## Who learns what

| | learns | doesn't learn |
|---|---|---|
| hub | that a user has push turned on, and when it pushes them | the device's push token, so it can't link users with other hubs |
| transcryptor | which hub sends a push, and when | the push token |
| PHC | push tokens, and how many tags (hubs) each has | which hubs those are |
| Apple, Google, UnifiedPush server | that PubHubs pushes to the device, and when | the hub; the content is a random tag |

Linking a device's hubs takes PHC and the transcryptor together, as for pseudonyms. Two weaker
signals remain:

- **Timing.** A hub knows when it pushes, and PHC when it delivers. Colluding hubs could also compare
  when pushers change: the app re-registers on every hub at once when the device's token changes,
  which is rare.
- **The blob is classical crypto** (P-256 ECDH and AES-GCM, as WebCrypto offers), unlike the
  post-quantum keys between the servers. A future quantum computer could open stored blobs; then
  again, the pseudonyms are ElGamal.

## Setting up PHC

Add credentials under `phc.push` in PHC's config. Without them, pushes to that platform fail and
are retried; UnifiedPush needs none.

```yaml
phc:
  push:
    apns:
      key_id: ABC123DEFG          # the <KEYID> in AuthKey_<KEYID>.p8
      team_id: T5VXGLDWLZ
      private_key: |              # the contents of the .p8
        -----BEGIN PRIVATE KEY-----
        ...
      sandbox: false              # true for app builds from Xcode
    fcm:                          # a service account of the gplay build's Firebase project
      project_id: pubhubs-app
      client_email: push@pubhubs-app.iam.gserviceaccount.com
      private_key: |
        -----BEGIN PRIVATE KEY-----
        ...
```

The blob key and the VAPID key are derived from PHC's `enc_key`. If that changes, the app registers
its pushers again when it next starts.

## The app

- **iOS:** `ios/App/App/NativePushPlugin.swift`. iOS shows the alert from the app's
  `Localizable.strings`.
- **Android:** `android/app/src/gplay/` (FCM) and `android/app/src/fdroid/` (UnifiedPush; the user
  needs a distributor app such as ntfy). Pushes are data only; the app shows the notification
  (`LocalNotifier.java`).

All three are the `NativePush` plugin with the same events, so `nativePush.ts` doesn't need to know
which one it runs on.
