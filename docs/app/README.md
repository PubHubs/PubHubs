# Specific info for developing the App

## networkhost.ip for iOS

For iOS/Capacitor dev builds, PHC hands out hub/MSS URLs built from the `networkhost` alias (not `localhost`), resolved via `pubhubs/pubhubs.toml`'s `[host_aliases] networkhost.ip`
(or the `networkhost.source_ip_for` auto-detect default in `pubhubs.default.toml`).
Since a device can't reach `localhost` on the dev machine, two things need to point at that same IP instead of `localhost`:

- `ios/App/App/Info.plist` needs a matching ATS exception domain keyed on that IP.
- `global-client`'s `PUBHUBS_URL`/`PHC_URL` need to actually request that IP — otherwise the app never even attempts the address ATS was opened up for.
  This is why the app can work fine in the iOS Simulator (which shares the Mac's network, so `localhost` resolves to the dev machine) while failing on a real device.

The tracked `global-client/public/client-config.js` keeps its defaults — device-specific overrides go in `global-client/public/client-config.local.js` instead.

Both `Info.plist` and `client-config.local.js` are kept in sync automatically — `pubhubs.toml` is the source of truth they're generated from.
`npm run sync:networkhost-ip` (at the repo root) does this, and it also runs automatically before `cap:sync`, `cap:run:ios`, and `cap:open:ios`, so there's normally nothing to do by hand.
See `scripts/sync-networkhost-ip.js`.
