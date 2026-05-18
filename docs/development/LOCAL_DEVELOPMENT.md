# Running a local development setup

If you have already enabled this git feature, you can disable it with the following command:

```
git config --global core.autocrlf false
```

After you have done so, you might need to re-clone the repository.

## First time installation

For a minimal working setup, make sure you have:

- [Node.js](https://nodejs.org) (version 22.0.0 or higher)
- [Cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html)
- [Docker](https://www.docker.com/)
- [Mask](https://github.com/jacobdeichert/mask) (for running development commands)

If you are using NixOS, you can use the provided [Nix flake](https://nixos-and-flakes.thiscute.world/development/dev-environments) to enter a development shell with the required dependencies (except for Docker, which must already be installed on your system). This may also work on other Linux distributions using the Nix package manager.

```bash
nix develop
```

## Usage

We use [Mask](https://github.com/jacobdeichert/mask) to manage development commands. All commands are defined in `maskfile.md` at the repository root.

### Quick start

Initialize the development environment (only needed once or after wiping):

```bash
mask run init
```

Run everything in a tmux session:

```bash
mask run all
```

This starts:

- Yivi server
- Garage S3 server
- PubHubs Central
- Global client (port 8080)
- Hub server 0 (port 8008)
- Hub client 0 (port 8001)

### Running components individually

```bash
mask run yivi           # Yivi server
mask run s3             # Garage S3 storage
mask run servers        # PubHubs Central
mask run client         # Global client (port 8080)
mask run hub server 0   # Hub server 0 (port 8008)
mask run hub client 0   # Hub client 0 (port 8001)
```

You can run multiple hub servers/clients by changing the number (0-4).

### Development against staging

For hub client development without running a local backend:

```bash
mask run hub mainclient       # Hub client against staging server
mask run hub mainclient enter # Get login URL with access token
```

The PubHubs client can be found at: http://localhost:8080

## Reachable IP address

For your local PubHubs instance to be reachable by the Yivi app, your host's IP address must be reachable by your phone (perhaps by having them both on the same Wi-Fi network.) PubHubs will try to guess your IP address using `ifconfig.me` (provided `urls.for_yivi_app` is set to `!autodetect` in the configuration file,) but you can also set `url.for_yivi_app` manually. For details, see comments in `default.yaml`.

When the Yivi app suggests you should check your phone's internet access, this might actually indicate that:

- **Your host is behind a NAT and your phone is not on the same network.** This is the case when the IP address reported by your operating system differs from the one from, say, https://ifconfig.me. (If you have control over the NAT, you might be able to setup port forwarding, pinholing, or put your host in the DMZ.)
- **Your host is behind a firewall.** To check this, run, say, `nmap 1.2.3.4` if `1.2.3.4` is your IP address. When no firewall is present, you should get:

    ```
    PORT      STATE SERVICE
    8008/tcp  open  http
    8080/tcp  open  http-proxy
    8088/tcp  open  radan-http
    ```

    For comparison, Apple's firewall blocking port 8080 looks like this:

    ```
    PORT     STATE    SERVICE
    8008/tcp open     http
    8080/tcp filtered http-proxy
    8088/tcp open     radan-http
    ```

    If you have control over the firewall, you might choose to disable it. (Making an exception for PubHubs might prove tedious, since the binary changes with every recompilation.)

- **If you're using an iPhone on the same network as your host**, that your iPhone's traffic is routed through one of Apple's servers via **[private relay](https://support.apple.com/en-us/HT212614)**. You can disable Private Relay globally, or just "Limit IP Address Tracking" per Wi-Fi network.

If nothing else helps, and you have access to a server with a public IP address, say 1.3.3.7, you can solve the problem by forwarding your local port to this server, via

```bash
ssh -R 8080:localhost:8080 username@yourserver.com
```

and have the Yivi app contact 1.3.3.7 instead by setting

```yaml
urls:
    # [...]
    for_yivi_app: !manual http://1.3.3.7:8080/
```

in your configuration file (e.g. `config.yaml`.)

## Developing the Hub and using Yivi

Before using Yivi in a local environment you have to activate developer-mode in Yivi (see https://irma.app/docs/yivi-app/#developer-mode), this will enable HTTP connections to Yivi. Otherwise the qr-code that is generated will be recognized by Yivi, but an error will be raised stating 'https: remote server does not use https'.

If you are developing a component of the Hub (client) that uses Yivi, you will notice the normal qr-code flow will not work. If your phone gives an error, this is probably because your phone will try to redirect to localhost, which is where your pc is serving the Hub but your phone doesn't serve anything on localhost. To fix this, look for the commented out `public_yivi_url` field in `homeserver.yaml`. Uncomment this and change it, filling in the ip-address of your pc.

## Android development

To develop on an Android device:

1. Run `mask run all` to start the local environment.
2. Activate developer mode on your phone (tap Build number 10 times in Settings > About phone).
3. Enable USB debugging in Developer options.
4. Connect your phone via USB and allow USB debugging in the pop-up prompt.
5. Run `mask run android ports` to forward all required ports.
6. Open `localhost:8080` in your phone's browser.
7. To read the console: use `about:debugging` in Firefox or `chrome://inspect` in Chrome.

## Testing the PubHubs components

All components have unit tests that can be run locally.

### Central platform tests

In `pubhubs/` run:

```bash
cargo test
cargo clippy -- --deny "warnings"
```

### Hub tests

Requires Python 3.10+.
In `pubhubs_hub/` run:

```bash
python -m xmlrunner discover -p '*_test.py' --output-file report.xml
```

This requires installing xmlrunner with `pip install unittest-xml-reporting`.
To use the latest dependencies for the hub locally too, use `pip install --upgrade -r requirements.txt`.

### Global client tests

From the repository root:

```bash
npm run test:run --workspace=global-client
```

### Hub client tests

From the repository root:

```bash
npm run test:run --workspace=hub-client
```

## Building static assets

- Static assets for the PubHubs Central server, so far just css, are built through build.rs, before launching the server. The build script expects npm (with sass) to be installed.
- Assets needed for the client are built with the several build options for the client.

# Troubleshooting

## Outdated `rustc`

When `cargo run` complains that `rustc` is outdated, update cargo (using `rustup update` if you installed rust via `rustup`.)

## Cleanup tmux session

If the tmux session gets stuck, you can clean it up with:

```bash
mask run all cleanup
```
