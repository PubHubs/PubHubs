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

There are three main parts to PubHubs:

1. The PubHubs platform itself, for central login and authentication. Hubs will only get pseudonyms but never the central identity.
2. The hubs, [matrix](https://matrix.org/) homeservers, in the ultimate PubHubs platform these will not be federated so ids are not shared between hubs (in the longer term we'd like to link hubs to be able to share content so maybe some federation will happen).
3. A matrix client to make sure the user can communicate with hubs.

This pubhubs directory contains the platform itself. The directory pubhubs_hub contains the modules we need to make hubs work within PubHubs. The client we will develop in the future.

For the identity oriented functionalities of PubHubs we use [IRMA](https://irma.app/). IRMA is also used for logging in to the central platform.

### Building static assets

Static assets, so far just css, are build through build.rs, before launching the server. The build script expects npm (with sass) to be installed.

### Running the webserver for (development purpose only)

Settings are in the `default.yaml` file, for development these initial settings should work.

### Project Dependencies

- [Cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html)
- [Cargo Watch](https://github.com/watchexec/cargo-watch)
- [Node Package Manager](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Docker](https://www.docker.com/)
- [Sass](https://sass-lang.com/install)
- [Libpepcli](https://gitlab.science.ru.nl/bernardg/libpep-cpp)

### Setting up external services

The external services for development are: an IRMA server, a Hub (matrix home server) and a matrix client. We currently use our own modified Element client, that image is not publicly available. In docker-compose.yaml you will need to change `registry.science.ru.nl/ilab/pubhubs-element-web/pubhubs-element-web` to
`vectorim/element-web`. We are planning to develop our own client, but that is not yet finished.

There is a python script that should automate some set-up:

```shell
python3 start_test_setup.py run --cargo-disabled
```

This will only build containers for IRMA, Hub and Client. Central Platform should be build and run separately with cargo.

```shell
python3 start_test_setup.py run --cargo-enabled <cargo_arguments>
```

This will only build containers for IRMA, Hub and Client, This will also build and run Central Platform with cargo. Cargo arguments `<cargo_arguments>` needs to be provided by the user e.g., cargo run or cargo watch.

We've not tested it on Windows, but it should work on linux and mac.

This script will launch three containers:

1. The hub.
2. Element, the matrix client.
3. An IRMA server for revealing personal attributes.

If the hub is not yet registered on the PubHubs server, the script will register the hub.

After running the script, check whether the IRMA server has started by checking the log of IRMA container.

```shell
   docker logs -f irma
```

The following output would be achieved when IRMA server is started e.g.,:

```shell
level=info msg="Server listening at :8088/"
level=info msg="checking for updates" scheme=irma-demo type=issuer
```

The hub can be used on http://localhost:8800.

#### Public IP address

For your local PubHubs instance to be reachable by the IRMA app, you must have a public IP address, which PubHubs will try to guess using `ifconfig.me` (provided `pubhubs_host = autodetect`) in the `default.yaml` file. When the IRMA app suggests you should check your phone's internet access, this might actually indicate that your PubHub instance is behind a NAT. You can circumvent this problem if you have access to a server with a public IP address, say 1.3.3.7, by forwarding your local port to this server, via

```shell
ssh -R 8080:localhost:8080 username@yourserver.com
```

and have the IRMA app contact 1.3.3.7 instead by setting `pubhubs_host = http://1.3.3.7:8080/`.

### Development dependencies

We use libpepcli to make pseudonyms. Please install it on your system:

```shell
sh -c 'printf "deb http://packages.bitpowder.com/debian-%s main core\n" `lsb_release -cs`' | tee /etc/apt/sources.list.d/bitpowder-repo.list
curl -L https://bitpowder.com/packages/linux-packages.gpg | tee /etc/apt/trusted.gpg.d/bitpowder.asc

apt-get update && apt-get install -y pepcli
```

For mac build, see https://gitlab.science.ru.nl/ilab/libpep
