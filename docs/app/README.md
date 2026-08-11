# Specific info for developing the App

## networkhost.ip for iOS

For iOS/Capacitor dev builds, PHC hands out hub/MSS URLs built from the `networkhost` alias (not `localhost`), resolved via `pubhubs/pubhubs.toml`'s `[host_aliases] networkhost.ip`
(or the `networkhost.source_ip_for` auto-detect default in `pubhubs.default.toml`).
Since a device can't reach `localhost` on the dev machine, `ios/App/App/Info.plist` needs a matching ATS exception domain keyed on that same IP.

This is kept in sync automatically — `pubhubs.toml` is the source of truth, `Info.plist` is generated from it.
`npm run sync:networkhost-ip` (at the repo root) does this, and it also runs automatically before `cap:sync`, `cap:run:ios`, and `cap:open:ios`, so there's normally nothing to do by hand.
See `scripts/sync-networkhost-ip.js`.

It works whether `pubhubs.toml` sets an explicit `networkhost.ip` or relies on the default `source_ip_for` auto-detect
(mirroring the same UDP trick `pubhubs/src/servers/config/host_aliases.rs` uses).
The only case it can't handle is being offline with no explicit `networkhost.ip` set — then it warns and leaves `Info.plist` unchanged.
If you hit that, set an explicit `networkhost.ip` in your `pubhubs.toml` and re-run `npm run sync:networkhost-ip`.
