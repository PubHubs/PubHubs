# iOS push notification test

`mask test ios-push <n>` tests iOS push notifications from end to end via test hub `n`, on the
Simulator or on an iPhone (`scripts/test-ios-push.py`). It checks one link of the chain per step,
so a failure points at the link that broke. For how pushes travel, see [Push notifications](push.md).

## Setup

1. **APNs key.** Apple only lets an Account Holder or Admin create one (Developer portal → Keys →
   Apple Push Notifications service). Keys can be limited to one environment. Debug builds from
   Xcode get **sandbox** device tokens, so they need a key that's enabled for sandbox. Keep `.p8`
   files in the password manager, never in the repo.
2. **PHC.** Copy `pubhubs/pubhubs.default.toml` to `pubhubs/pubhubs.toml` (gitignored) and add the key:

   ```toml
   [phc.push.apns]
   key_id = "ABC123DEFG"     # the <KEYID> in AuthKey_<KEYID>.p8
   team_id = "T5VXGLDWLZ"
   sandbox = true
   private_key = """
   -----BEGIN PRIVATE KEY-----
   ...
   -----END PRIVATE KEY-----
   """
   ```

   Then run the servers (`mask run servers`, which includes the transcryptor the pushes go through).
3. **The hub.** Run `mask run hub server <n>`. Hubs need no push configuration, but the hub has to get
   the constellation from PHC, so start it on the same networkhost as PHC. After an IP change
   (another network), restart the hub.
4. **The app.** Run `npm run cap:run:ios`. This bakes in the current IP, so rebuild after an IP
   change. Allow notifications, log in, and open hub `n` once. The app registers its pusher on that
   hub, and again when its token, the hub's address or the login changes.
5. **Private IPs only:** Synapse refuses to push to private addresses (`192.168.x.x`, `10.x.x.x`). On
   such a network, add `ip_range_whitelist: ['<your IP>']` to `testhub<n>/homeserver.yaml` and
   restart the hub.

## Production

PHC pushes to App Store and TestFlight builds with `sandbox = false`: those builds get production
device tokens (Xcode sets `aps-environment` from the distribution profile). One PHC serves one
environment, so a production PHC doesn't push to builds from Xcode.

## Running

```sh
mask test ios-push 0                      # Simulator (the booted one)
mask test ios-push 0 --target device      # iPhone; follow the prompts
mask test ios-push 0 --only gateway       # just one step, plus the checks it depends on
mask test ios-push 0 --non-interactive    # no prompts: skips the visual checks and the tap step
```

Screenshots (Simulator only) and the app's console output go to `/tmp/pubhubs-ios-push-test-<time>/`.

**Device target:** the hub can't tell devices apart (that's the point), so the suite takes the hub's
newest pusher. Pass `--pushkey <pushkey>` to pick another one. The suite asks you to put the app in
the background or foreground, and to say what you saw.

## Steps

| Step | Checks | Automatic |
|---|---|---|
| hub | the hub runs and got the constellation from PHC (without it the push gateway doesn't know the transcryptor) | yes |
| config | `pubhubs/pubhubs.toml` has `[phc.push.apns]` with the app's topic | yes |
| credentials | Apple accepts the key for the configured environment. Uses an all-zero device token, so nothing is delivered | yes |
| token | Simulator: the token and this hub's pusher the app stored. Device: the hub's newest pusher | yes |
| pusher | the hub has that pusher, with a v2 blob, pointing at the hub's *current* address | yes |
| gateway | a push to the hub's push gateway goes through the transcryptor (with the hub's ticket) and PHC to Apple, and the banner shows | Apple's answer yes, banner by prompt |
| e2e | a message from another user in a room you're in makes Synapse push, and the banner shows | Apple's answer yes, banner by prompt |
| foreground | with the app open, no banner shows, and JS doesn't get the push, so the app stays where it is | Simulator yes (console), device by prompt |
| tap | tapping the banner hands the sealed tag to JS (`pushTapped`) and opens the hub | needs a tap |

The **e2e** step sends a real message ("iOS push test HH:MM:SS"). It picks another local user who
shares the smallest room with you, and uses an access token it reads from the hub's database. That's
fine for a local test hub and nothing else. To choose the room and sender yourself, run the script
directly with `--room` and `--sender-token`.

## Common failures

| Message | Cause |
|---|---|
| the hub hasn't got the constellation | PHC isn't running, or the hub was started on another IP than PHC uses: restart the hub |
| the pusher points at …, but the hub now runs at … | the pusher is from another network: relaunch the app |
| the pusher has no blob | it's from an app build before the push relay: relaunch the app |
| Apple answered 403 BadEnvironmentKeyInToken | the key is limited to the other environment (sandbox vs production) |
| Apple answered 403 InvalidProviderToken | wrong `key_id` or `team_id`, or the key was revoked |
| push gateway answered 502 | the transcryptor isn't running, or PHC couldn't deliver: see PHC's log |
| the push was rejected | Apple refused the token (sandbox vs production, or the app was reinstalled), or PHC's key changed |
| Synapse couldn't reach the push gateway: … 504 | private IP without `ip_range_whitelist`, or the pusher's address is stale |
| Synapse didn't push | the room is muted, or the sender is you |
