# PubHubs

PubHubs is the name for a new Dutch community network, based on public values. PubHubs stands for Public Hubs.
It is open and transparent and protects data of the network’s participants. PubHubs aims to connect people,
in different hubs, such as your family, sports club, school class, museum, local library, neighborhood, or municipality.
In each such hub, a relevant part of one’s own identity plays a role.
PubHubs focuses on reliable information, if necessary with digital signatures, and on trusted communication,
if necessary with guarantees of the identity of participants.

For more information see our [website](https://pubhubs.net/en/).

## Current status

The PubHubs project is absolutely not finished yet. Much of the code you find here will be changed before a definitive release.
However, we'd still like to show everyone the current status of the code.

## Contributing

This repository is a mirror of our internal repository where actual development happens. If you want to contribute or report an issue please contact us through: info@pubhubs.net
In the longer term we'd like to move to a more open way of developing, but for now our repository is tightly linked to our (testing) infrastructure, and we'd like to keep this link for now.

## Technical details

Pubhubs consists of the following components:

- **Pubhubs Central**: The PubHubs platform itself, for central login and authentication. Hubs will only get pseudonyms of the user but never the central identity.
- **Global Client**: The client which is used to navigate between Hubs. It uses an ifram to embed different Hubs (hosted on different servers).
- **Hubs**: Modified [matrix](https://matrix.org/) homeservers, in the PubHubs platform these will not be federated so ids are not shared between hubs (in the longer term we'd like to link hubs to be able to share content so maybe some federation will happen).
- **Hub clients**: A client which communicates to a Hub, embedded in the Global Client. This client is at its core a matrix client with specifics for PubHubs.

This pubhubs directory contains the platform itself.The directory pubhubs_hub contains the modules we need to make hubs work within PubHubs.

For the identity oriented functionalities of PubHubs we use [Yivi](https://Yivi.app/). Yivi is also used for logging in to the central platform.

### Project Dependencies

- [Cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html) (package manager for rust)
- [Cargo Watch](https://github.com/watchexec/cargo-watch)
- [Node Package Manager (npm)](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (package manager for javascript)
- [Docker](https://www.docker.com/)
- [Sass](https://sass-lang.com/install)
- [OpenSSL](https://www.openssl.org/)

Several libraries for the client, most important:

- [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)
- [TypeScript](https://www.typescriptlang.org)
- [Vue](https://vuejs.org)
- [Pinia](https://pinia.vuejs.org)
- [Vitest](https://vitest.dev)
- [Histoire](https://histoire.dev)


## Running a development setup

Default settings are in the `default.yaml`; for development these initial settings should work.  If you make a copy of `default.yaml` and call it `config.yaml`, this configuration is used instead.  To use an entirely different configuration file instead, you can pass its path (relative to the current working directory) via the environmental variable `PUBHUBS_CONFIG`, e.g. `PUBHUBS_CONFIG=my_config.yaml cargo run`. 

### Building static assets

Static assets for the PubHubs Central server, so far just css, are build through build.rs, before launching the server. The build script expects npm (with sass) to be installed.

Assets needed for the client are build with the several build options for the client.

### First time installation
#### Windows
For a minimal working setup, make sure you have [Node Package Manager (npm)](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html) and [Docker](https://www.docker.com/) installed.

As mentioned above the rust build script uses sass, install this using npm (globally so that it's accessible from the command line):
```shell
npm install -g sass
```
The rust script also uses openssl. To install openssl, we use vcpkg which you can install following their [installation instructions](https://vcpkg.io/en/getting-started). This results in an executable vcpkg.exe, which you can add to your PATH. Then install openssl:
```shell
vcpkg install openssl:x64-windows-static-md
vcpkg integrate install
```
This should work in most cases, but you might need to replace 'x64' by 'arm64'.

### Usage

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
