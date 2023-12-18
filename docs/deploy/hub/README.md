# Hub Configuration

> We also provide a docker compose file in `/docs/deploy/`. Please note that the docker compose file might be outdated and we advise not to use it rather follow docker steps mentioned in this guide.

## Prerequisites

### Hosting
The Hub is based on the [the Synapse server](https://github.com/matrix-org/synapse), which' documentation and community you can refer to for specific requirements. In general, for a small organisation (<64 users, not joining extremely large rooms on other servers), a 2(v)CPU server with 2GB of RAM should be enough to run both the client and the hub. Debian/Ubuntu is recommended, with an up-to-date installation of Docker.

Besides an option for remote access such as SSH, port 80 and 443 need to be accessible from the internet. It is recommended to put a reverse proxy such as nginx, Apache, Caddy, HAProxy or relayd in front of Synapse, and TLS is required unless you are testing the instance from the same machine. For proper testing, you also need (sub)domains for both the client and the hub which point to your server.

### Linking to the Central Platform
In order to deploy a Hub, the Hub Owner will have to make a contract with the Central Platform by providing their the Hub Name, Hub Description and Redirection URI by email. On agreement, the adminstrator will provide a confidential file with decrpytion key, client id and client password in a secure manner. 

Example information:
```c++
Name: 'Organisation Hub'
Description: 'Deployment testing of PubHubs for Organisation'
Host URI: hubhost.organisation.com
Client URI: hubclient.organisation.com
```

<img src=../../pictures/key-exchange.png alt="drawing" width="3000"/>

The confidential information recieved will be used while deploying the containers.

## Setting up a Hub

> A token will be provided to access docker containers. However, this practice is subject to change.

-   Credential to retreive docker container for a Hub

```shell
  docker login registry.science.ru.nl -u <username> -p <token>
```

-   Pull the Hub docker image

```shell
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:main
```

Now we will need the confidential information recieved for setting up the Hub.

-   The `decryption key` is used as an environment variable `HUB_SECRET` when running the container for Hub.

-   The client ID and client password are used `client id` and `client password` are used in the homeserver configuration file `homeserver.yaml`. A minimum sample file is provided in the `hub/` directory of this documentation. See the snippet below:

```c++
oidc_providers:
  - idp_id: pubhubs
    idp_name: "PubHubs ID provider"
    discover: true
    issuer: "https://stable.pubhubs.ihub.ru.nl/"
    client_id: <update client ID>
    client_secret: <update client password>
    scopes: ["openid"]
    skip_verification: false
    user_mapping_provider:
      module: conf.modules.pseudonyms.OidcMappingProvider
      config:  {
        libpubhubspath: /usr/lib/libpubhubs.so
      }
```
- Update the test_hub.log.config file with the one present in the template directory `docs/deploy/test_hub.log.config`.

-   Change permission on the `hub/` folder and its subdirectory.

```shell
chmod -R 777 hub
```

```shell
docker run -p 8008:8008 --mount "type=bind,src=<absolute_path>/hub,dst=/data"  -e HUB_SECRET=<decryption_key> -e SYNAPSE_CONFIG_DIR=/data registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:main
```

Please do not publish other ports to prevent matrix federation, which is currently a bit of a mismatch with the PubHubs identity principles.

The hub should now be running at localhost:8008, which you can test from the machine that it runs on. In order to be reachable from the outside, some sort of reverse proxy on port 443 with TLS is needed. 

## Terms and conditions for the Hub

A `templates` directory can be created specifying the terms and conditions of the Hub. See sample in pubhubs repository `pubhubs_hub/matrix_test_config/templates`. The template directory can be used for styling the hub. A sample template directory can be found in `pubhubs_hub/matrix_test_config/templates`. Copy this template directory in <absolute_path>/hub (path mounted in docker run).

    
  [Client Instructions &rarr;](../client/README.md)
[&larr; Table of Content](../README.md)