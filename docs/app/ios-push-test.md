# iOS push notification test

`mask test ios-push <n>` tests iOS push notifications from end to end via test hub `n`, on the
Simulator or on an iPhone (`scripts/test-ios-push.py`). It checks one link of the chain per step,
so a failure points at the link that broke.

## Setup

1. **APNs key.** Apple only lets an Account Holder or Admin create one (Developer portal → Keys →
   Apple Push Notifications service). Keys can be limited to one environment. Debug builds from
   Xcode get **sandbox** device tokens, so they need a key that's enabled for sandbox. Keep `.p8`
   files in the password manager, never in the repo.
2. **Sygnal for the hub.** Copy `pubhubs_hub/config/local/sygnal.local.yaml` to
   `pubhubs_hub/testhub<n>/sygnal.yaml` and uncomment the `nl.pubhubs.client.ios` app. Set `key_id`
   (the `<KEYID>` in `AuthKey_<KEYID>.p8`) and `platform: sandbox`. Copy the key to
   `pubhubs_hub/testhub<n>/sygnal-apns-key.p8`. `testhub*/` is gitignored.
3. **PHC and the hub.** Run `mask run hub server <n>`. Sygnal only starts if `sygnal.yaml` exists when
   the hub boots, so restart the hub after step 2. The hub needs its hub id from PHC, so it has to be
   started on the same networkhost as PHC. After an IP change (another network), restart the hub.
4. **The app.** Run `npm run cap:run:ios`. This bakes in the current IP, so rebuild after an IP
   change. Allow notifications, log in, and open hub `n` once. The app registers its pusher on that
   hub, and registers it again on every launch.
5. **Private IPs only:** Synapse refuses to push to private addresses (`192.168.x.x`, `10.x.x.x`). On
   such a network, add `ip_range_whitelist: ['<your IP>']` to `testhub<n>/homeserver.yaml` and
   restart the hub.

## Running

```sh
mask test ios-push 0                      # Simulator (the booted one)
mask test ios-push 0 --target device      # iPhone; follow the prompts
mask test ios-push 0 --only gateway       # just one step, plus the checks it depends on
mask test ios-push 0 --non-interactive    # no prompts: skips the visual checks and the tap step
```

Screenshots (Simulator only) and the app's console output go to `/tmp/pubhubs-ios-push-test-<time>/`.

**Device target:** the device's token is the newest iOS pusher on the hub that isn't from a Simulator.
Pass `--pushkey <token>` to pick another one. The suite asks you to put the app in the background or
foreground, and to say what you saw.

## Steps

| Step | Checks | Automatic |
|---|---|---|
| hub | the hub runs, Sygnal started, and the hub resolved its hub id from PHC (without it the push gateway refuses every push) | yes |
| config | `sygnal.yaml`'s iOS app: `type: apns`, `topic: net.pubhubs.app`, `convert_device_token_to_hex: false`, and the key file exists | yes |
| credentials | Apple accepts the key for the configured environment. Uses an all-zero device token, so nothing is delivered | yes |
| token | Simulator: the token the app stored. Device: the hub's pushers | yes |
| pusher | the hub has a pusher for that token, pointing at the hub's *current* address | yes |
| gateway | a push straight to the hub's push gateway goes through Sygnal to Apple, and the banner shows | Apple's answer yes, banner by prompt |
| e2e | a message from another user in a room you're in makes Synapse push, and the banner shows | Apple's answer yes, banner by prompt |
| foreground | with the app open, no banner shows, and JS gets `pushReceived` with the hub's id | Simulator yes (console), device by prompt |
| tap | tapping the banner hands the hub id to JS and opens the hub | needs a tap |

The **e2e** step sends a real message ("iOS push test HH:MM:SS"). It picks another local user who
shares the smallest room with you, and uses an access token it reads from the hub's database. That's
fine for a local test hub and nothing else. To choose the room and sender yourself, run the script
directly with `--room` and `--sender-token`.

## Common failures

| Message | Cause |
|---|---|
| the hub hasn't resolved its hub id | PHC isn't running, or the hub was started on another IP than PHC uses: restart the hub |
| the pusher points at …, but the hub now runs at … | the pusher is from another network: relaunch the app |
| Apple answered 403 BadEnvironmentKeyInToken | the key is limited to the other environment (sandbox vs production) |
| Apple answered 403 InvalidProviderToken | wrong `key_id` or `team_id`, or the key was revoked |
| Apple rejected the token | `BadDeviceToken`: a sandbox token sent to production or the other way round, or the app was reinstalled |
| Synapse couldn't reach the push gateway: … 504 | private IP without `ip_range_whitelist`, or the pusher's address is stale |
| Synapse didn't push | the room is muted, or the sender is you |
