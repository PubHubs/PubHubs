# Running a local development setup

Default settings are in the `default.yaml`; for development these initial settings should work.  If you make a copy of `default.yaml` and call it `config.yaml`, this configuration is used instead.  To use an entirely different configuration file instead, you can pass its path (relative to the current working directory) via the environmental variable `PUBHUBS_CONFIG`, e.g. `PUBHUBS_CONFIG=my_config.yaml cargo run`.

**WARNING**: When checking out on a windows machine, don't have git convert the line endings to CRLF. (Otherwise the CR causes trouble in the hub container.) 
If you have already enabled this git feature, you can disable it with the following command:
```
  git config --global core.autocrlf false
```
After you have done so, you might need to re-clone the repository.

## First time installation

For a minimal working setup, make sure you have [Node Package Manager (npm)](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html) and [Docker](https://www.docker.com/) installed.

If you are using NixOS, you can use the provided [Nix flake](https://nixos-and-flakes.thiscute.world/development/dev-environments) to enter a development shell with the required dependencies (except for Docker, which must already be installed on your system). This may also work on other Linux distributions using the Nix package manager. Alternatively, you can manually install the required dependencies.

The rust build script uses sass, install this using npm (globally so that it's accessible from the command line):
```shell
npm install -g sass
```
To build pubhubs central, openssl is required. On Windows, we recommend obtaining openssl via vcpkg, which you can install following their [installation instructions](https://vcpkg.io/en/getting-started). This results in an executable vcpkg.exe, which you can add to your PATH. Then install openssl:
```shell
vcpkg install openssl:x64-windows-static-md
vcpkg integrate install
```
This should work in most cases, but you might need to replace 'x64' by 'arm64'.

## Usage

We will setup docker containers for a Yivi server, a Hub and a Hub Client.
Pubhubs Central is built and served seperately (by a rust sript) and also serves the Global client.

There is a python script `start_test_setup.py` that should automate some set-up.
To see available options, run:
```
python3 start_test_setup.py
```

**Recommended usage**:

First we build and run the Pubhubs Central with rust (This will run a server which also serves the Global Client).
```shell
cd pubhubs
cargo run
```
In a second terminal we setup and run the docker containers (make sure docker is running):
```shell
python3 start_test_setup.py exec --cargo-disabled
```
This will launch three docker containers:
1. The hub.
2. The client.
3. An Yivi server for revealing personal attributes.

If the hub is not yet registered on the PubHubs server, the script will register the hub.

After running the script, check whether the Yivi server has started by checking the log of Yivi container.

```shell
   docker logs -f yivi
```

The following output would be achieved when Yivi server is started e.g.,:

```shell
level=info msg="Server listening at :8088/"
level=info msg="checking for updates" scheme=irma-demo type=issuer
```

The PubHubs javascript client can be found here: http://localhost:8080/client

#### Reachable IP address

For your local PubHubs instance to be reachable by the Yivi app, your host's IP address must be reachable by your phone (perhaps by having them both on the same Wi-Fi network.) PubHubs will try to guess your IP address using `ifconfig.me` (provided `urls.for_yivi_app` is set to `!autodetect` in the configuration file,) but you can also set `url.for_yivi_app` manually.  For details, see comments in `default.yaml`.

When the Yivi app suggests you should check your phone's internet access, this might actually indicate that:

- **Your host is behind a NAT.** This is the case when the IP address reported by your operating system differs from the one from, say, https://ifconfig.me. (If you have control over the NAT, you might be able to setup port forwarding, pinholing, or put your host in the DMZ.)
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

- **If you're using an iPhone on the same network as your host**, that your iPhone's traffic is routed through one of Apple's server via **[private relay](https://support.apple.com/en-us/HT212614)**. You can disable Private Relay globally, or just "Limit IP Address Tracking" per Wi-Fi network.

If nothing else helps, and you have access to a server with a public IP address, say 1.3.3.7, you can solve the problem by forwarding your local port to this server, via

```shell
ssh -R 8080:localhost:8080 username@yourserver.com
```

and have the Yivi app contact 1.3.3.7 instead by setting
```
urls:
    # [...]
    for_yivi_app: !manual http://1.3.3.7:8080/
```
in your configuration file (e.g. `config.yaml`.)

### Developing the Hub and using Yivi
Before using Yivi in a local environment you have to activate developer-mode in Yivi (see https://irma.app/docs/yivi-app/#developer-mode), this will enable HTTP connections to Yivi. Otherwise the qr-code that is generated will be recognized by Yivi, but an error will be raised stating 'https: remote server does not use https'.

If you are developing a component of the Hub (client) that uses Yivi, you will notice the normal qr-code flow will not work. If your phone gives an error, this is probably because your phone will try to redirect to localhost, which is where your pc is serving the Hub but your phone doesn't serve anything on localhost. To fix this, look for the commented out `public_yivi_url` field in `homeserver.yaml`. Uncomment this and change it, filling in the ip-address of your pc.

### Testing the PubHubs components

All components have some unit tests they can be run locally.

### Central platform tests

In `pubhubs` run `cargo test`.

### Hub tests

Requires python 3.10+.
In 'pubhubs_hub' run `python -m xmlrunner discover -p '*_test.py' --output-file report.xml`. This requires installing xmlrunner with `pip install unittest-xml-reporting`.
To use the latest dependencies for the hub locally too, use `pip install --upgrade -r requirements.txt`.

### Global client tests

In `global-client`  run `npm run test`. To install the dependencies locally use `npm ci` or `npm install`.

### Hub client tests

In `local-client`  run `npm run test`. To install the dependencies locally use `npm ci` or `npm install`.


## Building static assets

- Static assets for the PubHubs Central server, so far just css, are build through build.rs, before launching the server. The build script expects npm (with sass) to be installed.
- Assets needed for the client are build with the several build options for the client.

## Rebranding a hub client

A Hub's client can have its own branding. Documentation can be found in `docs/hub_branding`.

# Troubleshooting
## Outdated `rustc`
When  `cargo run` complains that `rustc` is outdated, update cargo (using `rustup update` if you installed rust via `rustup`.)

