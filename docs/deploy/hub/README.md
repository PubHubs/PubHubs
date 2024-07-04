# Deploying a hub

This page documents how to deploy a hub. We assume you have a basic overview of how PubHubs works, have been in contact with PubHubs Central about running a Hub and would now like to actually setup and deploy your hub. For more information on PubHubs in general, see the main [readme](../../../README.md).

## Prerequisites

In order to run a Hub you will need to run a Hub server and a Hub client. You will also need to contact PubHubs Central to get some secrets and configuration which are needed to join the PubHubs network. This documentation is only about the technical aspects of setting up a hub. More might be necessary, like signing a contract.

### Hosting

The Hub server is based on the [the Synapse server](https://github.com/matrix-org/synapse). You can refer to its documentation and community for specific requirements.In general, for a small organisation (<64 users), a 2(v)CPU server with 2GB of RAM should be enough to run both the Hub client and the Hub server. Debian/Ubuntu is recommended, with an up-to-date installation of Docker.

Besides an option for remote access such as SSH, port 80 and 443 need to be accessible from the internet. It is recommended to put a reverse proxy such as nginx, Apache, Caddy, HAProxy or relayd in front of your Hub server and client, and TLS is required unless you are testing locally on your machine. For proper testing, you also need (sub)domains for both the client and the Hub which point to your server.

### Linking to the PubHubs Central

To be able to join the PubHubs network, you will need to provide the following information about your future Hub (by email):

- Hub name - we will sometimes write `<hub_name>`, this is the Hub name in lowercase_snake_case
- Hub description - a short text describing your hub. Users will see this in the Hub overview page underneath the Hub name.
- Hub server domain name - should be of the form `<hub_name>.ph.<your domain>`.
- Hub client domain name - should be of the form `<hub_name>-client.ph.<your domain>`.

On agreement, PubHubs Central will provide the following information in a secure manner. Please note that this information is confidential must be kept secret.

- Access token - for retrieving the Hub server and Hub client docker images
- Hub secret - which is used to retrieve a user's pseudonym from the central login
- OpenId Connect client id and client secret - which the Hub server needs in its configuration file to function properly

```c++
Example information

Name: 'The Library'
Description: 'Find help for the digital world at The Library'
Host URI: the_library.ph.librarywebsite.com
Client URI: the_library-client.ph.librarywebsite.com
```

<img src=../../pictures/key-exchange.png alt="drawing" width="3000"/>

## Setting up a Hub
Below are instructions for the actual setup and deployment of the Hub server. You will need the information you received from PubHubs Central. For deploying the Hub client, see the documentation for [deploying the Hub client](../client/README.md).

The Hub server will be a docker container that runs on your server. You will first need to get the docker image from us.
```
docker login registry.science.ru.nl -u <hub_name> -p <access token>
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:stable
```
Data such as configuration data and the database are persistent, they will be mounted inside the docker container. Create a directory `hub_dir` on the server that will run the docker containers. We will add some initial configuration to this directory.
- Copy the PubHubs default configuration for the synapse server from `pubhubs_hub/matrix_test_config/homeserver.yaml` to `hub_dir`. You will need to make changes to this file. See the file for further instructions.
- Also from the `pubhubs_hub/matrix_test_config/` directory, copy over the `templates` folder and the `test_hub.log.config` file to `hub_dir`. Rename `test_hub.log.config` to `log.config`.
- The synapse server needs access to the mounted `hub_dir` folder with a user and group with id `991`. Run `chown -R 991:991 hub_dir`.

You should now be able to run the hub server:
```
docker run -p 8008:8008 -v <path_to_hub_dir>:/data -e HUB_SECRET=<Hub secret> -e SYNAPSE_CONFIG_DIR=/data registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:stable
```
Please do not publish other ports to prevent matrix federation, which is currently a bit of a mismatch with the PubHubs identity principles.

The Hub should now be running at localhost:8008, which you can test from the machine that it runs on. In order to be reachable from the outside, some sort of reverse proxy on port 443 with TLS is needed.

If the Hub server container crashed, please check the logs for errors. If it crashes because of a misconfiguration, the logs will tell you. If there are no errors, you have your hub server up and running!

## Terms and conditions for the Hub

In the `templates` directory you copied over from `pubhubs_hub/matrix_test_config/templates`, you will find `sso_new_user_consent.html` file. This is the page shown to users before entering your Hub the first time. You can customize this page with information about your Hub, terms and conditions and house rules.

[Hub client Instructions &rarr;](../client/README.md)
[&larr; Table of Content](../README.md)

> A token will be provided to access docker containers. However, this practice is subject to change.

- Credential to retreive docker container for a Hub

```shell
  docker login registry.science.ru.nl -u <username> -p <token>
```

- Pull the Hub docker image

```shell
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:stable
```

Now we will need the confidential information recieved for setting up the Hub.

- The `decryption key` is used as an environment variable `HUB_SECRET` when running the container for Hub.

- The client ID and client password are used `client id` and `client password` are used in the homeserver configuration file `homeserver.yaml`. A minimum sample file is provided in the `hub/` directory of this documentation. See the snippet below:

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

- Change permission on the `hub/` folder and its subdirectory.

```shell
chmod -R 777 hub
```

```shell
docker run -p 8008:8008 --mount "type=bind,src=<absolute_path>/hub,dst=/data"  -e HUB_SECRET=<decryption_key> -e SYNAPSE_CONFIG_DIR=/data registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:stable
```

Please do not publish other ports to prevent matrix federation, which is currently a bit of a mismatch with the PubHubs identity principles.

The Hub should now be running at localhost:8008, which you can test from the machine that it runs on. In order to be reachable from the outside, some sort of reverse proxy on port 443 with TLS is needed.

## Terms and conditions for the Hub

A `templates` directory can be created specifying the terms and conditions of the Hub. See sample in pubhubs repository `pubhubs_hub/matrix_test_config/templates`. The template directory can be used for styling the hub. A sample template directory can be found in `pubhubs_hub/matrix_test_config/templates`. Copy this template directory in <absolute_path>/Hub (path mounted in docker run).

[Client Instructions &rarr;](../client/README.md)
[&larr; Table of Content](../README.md)
