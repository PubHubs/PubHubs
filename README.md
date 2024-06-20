# PubHubs

PubHubs is the name for a new Dutch community network, based on public values. PubHubs stands for Public Hubs.
It is open and transparent and protects data of the network’s participants. PubHubs aims to connect people,
in different hubs, such as your neighborhood, sports club, school class, museum, patient organisation, local library, municipality.
In each such hub, a relevant part of one’s own identity plays a role.
PubHubs focuses on reliable information, if necessary with digital signatures, and on trusted communication,
if necessary with guarantees of the identity of participants.

### Contact

**For more information and contact see our** [website](https://pubhubs.net/en/).

## Current status

The PubHubs project is not finished. We gradualy moving towards several test fases. Much of the code you find here will be changed before a definitive release.
However, we'd still like to show everyone the current status of the code. And if you or your organisation would like to be involved during the testfases, please contact us.

## Contributing

This repository is a mirror of our internal repository where actual development happens. If you want to contribute, test, or report an issue. **Please contact us**

In the longer term we'd like to move to a more open way of developing, but for now our repository is tightly linked to our (testing) infrastructure, and we'd like to keep this link for now.

## Technical details

Pubhubs consists of the following components:

- **Pubhubs Central**: The PubHubs platform itself, for central login and authentication. Hubs will only get pseudonyms of the user but never the central identity. PubHubs Central is written in Rust.
- **Global Client**: The client which is used to navigate between Hubs. It uses an iframe to embed different Hubs (hosted on different servers). The Global Client is written in TypeScript with Vue.
- **Hub servers**: Modified [matrix](https://matrix.org/) homeservers, in the PubHubs platform these will not be federated so ids are not shared between hubs (in the longer term we'd like to link hubs to be able to share content so maybe some federation will happen). The hub server is based on the matrix server [Synapse](https://matrix-org.github.io/synapse/latest/welcome_and_overview.html) and extended with custom PubHubs modules written in python. The hub server also uses a Yivi server for secured rooms etc.
- **Hub clients**: A client which communicates to a Hub, embedded in the Global Client. This client is at its core a matrix client with specifics for PubHubs like secured rooms (where you can restrict access using Yivi (see below) attributes e.g. an 18+ room). The Hub Client is written in TypeScript with Vue.

For the identity oriented functionalities of PubHubs we use [Yivi](https://Yivi.app/). Yivi is also used for logging in to the central platform.

### Folders

- docker_yivi - Everything needed for building the yivi image for PubHubs Central
- doc - Documentation
- global-client - The code for the global-client. It uses also code found in the `hub-client`.
- hub-client - The code for the hub-client.
- pubhubs - The code for PubHubs Central
- pubhubs_hub - Everything needed for building a hub's sever (Matrix). Including several Python modules for specific PubHubs features.

In the root folder you will find, amongst others the file `start_test_setup.py` which will help starting a local development setup.

### Project Dependencies

- [Cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html) (package manager for rust)
- [Cargo Watch](https://github.com/watchexec/cargo-watch)
- [Node Package Manager (npm)](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (package manager for javascript)
- [Docker](https://www.docker.com/)
- [Sass](https://sass-lang.com/install)
- [OpenSSL](https://www.openssl.org/)

Several libraries for the clients, most important:

- [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)
- [TypeScript](https://www.typescriptlang.org)
- [Vue](https://vuejs.org)
- [Pinia](https://pinia.vuejs.org)
- [Vitest](https://vitest.dev)
- [Histoire](https://histoire.dev)

## Further Documention

More information, regarding development, branding, deployment etc. can be found [here](docs/README.md).

Also:

- [Roadmap](./ROADMAP.md)
- [Changelog](./CHANGELOG.md)
