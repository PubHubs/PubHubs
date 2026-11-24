# Running a hub

A hub is run by the organisation it belongs to, on its own server: a hub server (Synapse with the
PubHubs modules) and a hub client, each in a Docker container behind a reverse proxy. This page
assumes you know [how PubHubs fits together](architecture.md) and have been in touch with the
PubHubs team about running a hub.

- [What you need](#what-you-need)
- [Registering the hub](#registering-the-hub)
- [The hub server](#the-hub-server)
- [The hub client](#the-hub-client)
- [Reverse proxy](#reverse-proxy)
- [Video calls](#video-calls)
- [Making the first admin](#making-the-first-admin)
- [Updating](#updating)

## What you need

- **A server.** For a small organisation (under 64 users), 2 (v)CPUs and 2 GB of RAM run both the
  hub server and the client. Debian or Ubuntu is recommended, with an up-to-date Docker.
- **Two domains**, one for the hub server and one for the client, both pointing at the server. Don't
  make one a subdomain of the other, so they don't share cookies and local storage. Users sometimes
  see the hub server's domain, in the Yivi app for example, so pick a friendly one.
- **Ports 80 and 443** open to the internet, and a reverse proxy with TLS in front of both
  containers.

The hub server is based on [Synapse](https://github.com/element-hq/synapse); its documentation
applies for anything not covered here.

## Registering the hub

Send the PubHubs team the following, for example with the
[Register a hub](https://github.com/PubHubs/PubHubs/issues/new?template=add-hub.yml) form on our
GitHub mirror:

- **Name**, as shown in PubHubs.
- **Description**, a short text shown with the name on the PubHubs homepage. A hub admin can change
  it later in the client.
- **Hub server domain**, for example `hub.librarywebsite.com`.

You get a **deploy token** back, a username and a token for pulling the images from the registry. It
is not confidential.

The PubHubs team then adds the hub to PubHubs Central's `pubhubs.toml`:

```toml
[[phc.hubs]]
handles = ['<handle>']
name = "<name>"
description = '''<description>'''
url = 'https://<hub server domain>/_synapse/client/'
id = '<id>' # cargo run tools generate id
```

Never change a hub's `id`, because users' pseudonyms are derived from it, and never remove a handle,
because that breaks links. See the comments in `pubhubs/pubhubs.default.toml`.

## The hub server

1. Log in to the registry and pull the image:

    ```sh
    docker login registry.science.ru.nl -u <deploy token username> -p <deploy token>
    docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:latest
    ```

2. Make a directory `hub_dir` for the hub's configuration and data, and copy into it, from
   `pubhubs_hub/matrix_test_config/`:
    - `homeserver.yaml`. Change every value marked _DO CHANGE_, and `http` to `https` where it
      applies.
    - `test_hub.log.config`, renamed to `log.config`; point `log_config` in `homeserver.yaml` at it.

3. Let Synapse, which runs as user and group `991`, use it:

    ```sh
    chown -R 991:991 hub_dir
    ```

4. Run it:

    ```sh
    docker run -p 8008:8008 \
      -v <path to hub_dir>:/data \
      registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:latest
    ```

    Don't publish other ports. The container also runs a Yivi server and a LiveKit server for its
    own use, and those must not be reachable from outside.

The hub now answers on `localhost:8008`. When it starts, it checks `homeserver.yaml`, fills in what
is missing, and stops with an explanation in its log when something is wrong.

A new hub keeps its database in `hub_dir/homeserver.db` (SQLite). On a later start, once Synapse has
finished its background updates, it moves it to a PostgreSQL inside the container, kept in
`hub_dir/postgres`, and renames `homeserver.db` to `homeserver.db.bak`.

## The hub client

```sh
docker login registry.science.ru.nl -u <deploy token username> -p <deploy token>
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:latest
docker run \
  --env 'HUB_URL=https://<hub server domain>' \
  --env 'PARENT_URL=https://app.pubhubs.net' \
  -p 8800:8800 \
  registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:latest
```

The client now answers on `localhost:8800`. PubHubs shows it in a frame inside the global client at
`PARENT_URL`, the only page allowed to embed it.

## Reverse proxy

Any reverse proxy works (nginx, Apache, Caddy, HAProxy, relayd), with TLS, as long as it passes the
requests on unchanged. Synapse's
[reverse proxy examples](https://element-hq.github.io/synapse/latest/reverse_proxy.html) are a good
start.

The hub server and client set these headers themselves, so don't set them in the proxy:

- `X-Frame-Options`
- `Access-Control-Allow-Origin`
- `Content-Security-Policy`

With nginx, a misconfigured proxy can cause an endless redirect loop; see
[synapse#10492](https://github.com/matrix-org/synapse/issues/10492).

## Video calls

Video calls use [LiveKit](https://livekit.io). The hub server checks who may join a call and hands
out LiveKit tokens; LiveKit carries the audio and video. The hub image contains a LiveKit server for
local development only. In production, run LiveKit yourself:

- Its signalling endpoint (HTTP and WebSocket) goes through the reverse proxy, with TLS.
- Its media ports (by default a UDP range and TCP 7885) must be open on the server itself; they
  can't go through the proxy or TLS. See the [LiveKit documentation](https://docs.livekit.io) on
  self-hosting.
- The hub server gets its address and credentials:

```sh
docker run \
  -e LIVEKIT_URL=https://livekit.example.org \
  -e LIVEKIT_API_KEY=<key> \
  -e LIVEKIT_API_SECRET=<secret> \
  ...
```

The hub refuses to hand out tokens when `LIVEKIT_URL` is not on `localhost` and the key or secret is
missing. How a call works is described in [Video calls](video-calls.md).

## Making the first admin

A hub starts without admins. Make the first one in the database; after that, admins can make others.

1. Log in to the hub once with the account that should become admin, so it exists.
2. Open the database. If `hub_dir` has a `homeserver.db.bak`, the hub is on PostgreSQL:

    ```sh
    docker exec -it <hub container> sudo -u postgres psql hub
    ```

    Otherwise it is still on SQLite (editing `homeserver.db.bak` has no effect):

    ```sh
    sqlite3 <path to hub_dir>/homeserver.db
    ```

3. Make the user admin, and leave with `\q` (PostgreSQL) or `.quit` (SQLite):

    ```sql
    UPDATE users SET admin = 1 WHERE name = '@abc-123:hub.example.org';
    ```

    `SELECT name FROM users;` lists the user ids.

4. Restart the hub container.

An admin can make others admin with the
[Synapse Admin API](https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html),
using the access token from their own session (search for `token` in the browser's network tab):

```sh
curl -X PUT "https://<hub server domain>/_synapse/admin/v2/users/@<user id>:<server name>" \
  -H "Authorization: Bearer <admin access token>" \
  -H "Content-Type: application/json" \
  -d '{"admin": true}'
```

Admins manage the hub's rooms, including secured rooms, from the hub client. The
[help pages](https://www.pubhubs.net/en/help/for-administrators/) explain how.

## Updating

The `latest` tag always points at the latest release. Every release also has its own tag, such as
`:v3.5.1`, which never changes. With `latest` you are always up to date; with a version tag you
decide when to update, and can go back if an update causes trouble. The
[changelog](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/blob/stable/CHANGELOG.md) lists
the releases, and marks changes that need something from you with `[BREAKING]`.

The PubHubs app needs a hub release with app support: older hubs refuse the app's requests to the
hub's own endpoints, so its users can't accept the house rules or change hub settings in the app.
Update your hub before your users start using the app; see
[what hubs need for the app](app/README.md#what-hubs-need-for-the-app).
