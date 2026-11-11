# Push notifications

When the app is closed, a new message in a hub shows the notification "You have new messages". Tapping
it opens that hub. The notification never says which hub, room, sender or message it's about. Why
it's built this way, and the choices made, is in [push-strategies.md](push-strategies.md) (option B).

## How a push travels

```
app ──pusher (random pushkey, blob)──▶ hub

hub's Synapse ─▶ hub's push gateway   (sends on only the blob, with the hub's ticket)
              ─▶ transcryptor          (knows the hub, can't read the blob; rate limits)
              ─▶ PHC                   (reads the blob, doesn't know the hub)
              ─▶ Apple / Google / UnifiedPush server ─▶ device: {sealed_tag} ─▶ app opens the hub
```

- **The app** gets a push token from its platform: APNs on iOS, FCM in the Android `gplay` build,
  or a UnifiedPush endpoint with Web Push keys in the `fdroid` build. For every hub it's logged in
  to, it registers a Matrix pusher with a random pushkey and, in the pusher's data, a **blob**: the
  token, a random per-hub **tag** and a random per-device **tag key**, encrypted for PHC
  (`global-client/src/logic/pushBlob.ts`). Each blob is encrypted afresh, so two hubs never get the
  same one. The app keeps the tag → hub map to itself (`global-client/src/logic/nativePush.ts`).
- **The hub's push gateway** (`pubhubs_hub/modules/pubhubs/_push_gateway_proxy.py`, at
  `_matrix/push/v1/notify` on the hub) gets Synapse's notifications and sends on only the blobs, to
  the transcryptor's `.ph/push`. No room, event, sender, counts or priority. It signs the request
  with the hub's own key and adds the hub's **ticket** from PHC, so only hubs can push.
- **The transcryptor** checks the ticket, applies the rate limits, and passes the blobs to PHC's
  `.ph/push/send`, sealed with the secret only it and PHC have. It doesn't tell PHC which hub they
  come from.
- **PHC** (`pubhubs/src/servers/phc/push.rs`) decrypts each blob and sends the push, with Apple's
  and Google's credentials or, for UnifiedPush, Web Push encrypted for the device and signed with
  PHC's VAPID key. The push carries only the **sealed tag**: the tag, encrypted with the tag key and
  a fresh random nonce, so it looks different every time. If a token is no longer valid, PHC says so,
  and the hub's Synapse deletes the pusher.
- **The app** opens the sealed tag with its tag key, looks the tag up, and opens that hub.

Every push is sent with high priority, and on iOS with a badge of 1, which the app clears when it's
opened. Android shows one notification for all pushes; a new push replaces it.

## Who learns what

| | learns | doesn't learn |
|---|---|---|
| hub | that a user has push turned on, and when it pushes them | the device's push token, so it can't link users with other hubs |
| transcryptor | which hub sends a push, and when | the push token |
| PHC | push tokens, and how many tags (hubs) each has | which hubs those are |
| Apple, Google, UnifiedPush server | that PubHubs pushes to the device, and when | the hub, how many hubs, and which pushes come from the same hub: every sealed tag is different |

Linking a device's hubs takes PHC and the transcryptor together, as for pseudonyms. Known gaps,
accepted for now:

- **Timing.** The transcryptor relays every push immediately, so PHC sees exactly when each push
  comes in, which helps it match pushes to hubs. A hub knows when it pushes. Colluding hubs could
  also compare when pushers change: the app registers again on every hub at once when the device's
  token changes, which is rare.
- **The blob is classical crypto** (P-256 ECDH and AES-GCM, as WebCrypto offers), unlike the
  post-quantum keys between the servers. A future quantum computer could open stored blobs; then
  again, the pseudonyms are ElGamal. The blob's version byte leaves room for a hybrid ML-KEM.

## Abuse protection

- **Only hubs can push.** `.ph/push` wants a `TicketSigned` request: a ticket from PHC, which names
  the hub and its verifying key, and the request, signed with the hub's key.
- **Rate limits** in the transcryptor, shared by its workers and kept in memory only:
  - per hub (default: bursts of 2000, 3000 a minute). Over it, the hub is told `TooManyPushes`, and
    Synapse tries again later;
  - per blob, so per device on one hub (default: bursts of 5, 6 a minute). Over it, pushes are
    dropped quietly: the device shows one notification for a burst anyway. The limiter keys on a
    hash of the blob, with a key that's random per run.

  Change them under `transcryptor.push_limits` (`per_hub` and `per_blob`, each `burst` and
  `per_minute`).

A hub can still push to the blobs it holds, up to these limits: that is, to its own users.

## Logging

PHC and the transcryptor log no tokens, endpoints, tags, blobs or hubs, and nothing per push. PHC
logs counts every 10 minutes (delivered, rejected, failed by kind of error), and at startup whether
APNs and FCM are configured.

## Setting up

### PHC

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

Who holds the `.p8` and the service account, how they're rotated, and how builds from Xcode get a
sandbox PHC, is still open (see push-strategies.md).

The blob key and the VAPID key are derived from PHC's `enc_key`. That only changes by hand, which
also logs every user out of PHC, or at every restart when it isn't configured (dev only). There's
no grace period: old blobs are rejected, Synapse deletes those pushers, and the app registers again
when it next starts.

### Hubs

Nothing to configure. On first start a hub makes its own signing key (composite ML-DSA-65 +
Ed25519, `pubhubs_hub/modules/pubhubs/_hub_signing.py`) and keeps it in
`/data/pubhubs_hub_signing_key.json`. Set `hub_signing_key_path` in the pubhubs module config to
keep it elsewhere. Keep it with the hub's data: with a new key the hub simply gets a new ticket.
The hub publishes the verifying key in its `.ph/info`, where PHC reads it when the hub asks for a
ticket.

### Monitoring

When PHC or the transcryptor is down, there are no pushes: Synapse retries with backoff, and a push
waits at most a day at Apple, Google or the UnifiedPush server. Monitor that PHC answers
`GET .ph/push/info`, and check PHC's startup log line `push: APNs on, FCM on`.

## The app

- **iOS:** `ios/App/App/NativePushPlugin.swift`. iOS shows the alert from the app's
  `Localizable.strings`.
- **Android:** `android/app/src/gplay/` (FCM) and `android/app/src/fdroid/` (UnifiedPush; the user
  needs a distributor app such as ntfy). Pushes are data only; the app shows the notification
  (`LocalNotifier.java`).

All three are the `NativePush` plugin with the same events, so `nativePush.ts` doesn't need to know
which one it runs on. They pass on the sealed tag as is; only `nativePush.ts` opens it.

## Testing

- Rust: `cargo test` in `pubhubs/`, including `tests/integration.rs` (relay, ticket, per-blob limit)
  and the cross-language vectors: `opens_blob_from_the_app` and `sealed_tag_vector` in `push.rs`,
  `python_hub_vector` in `common/dsa.rs`.
- App: `npx vitest run test/logic/pushBlob.test.ts` in `global-client/`.
- Hub: `python3 -m unittest discover -p '*_test.py'` in `pubhubs_hub/`.
- iOS end to end: [ios-push-test.md](ios-push-test.md).
