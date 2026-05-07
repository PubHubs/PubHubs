# Client settings

These are instructions to setup and run the Hub client. We assume that you already have the Hub server up and running.

## Setup

1. Login with the access token received in a confidential file (if not done for the Hub already):

```shell
docker login registry.science.ru.nl -u <requiredbutnotused> -p <access token>
```

2. Fetch the client container:

```shell
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:stable
```

3. Run the client:

```shell
docker run \
  --env 'HUB_URL=https://<Hub server domain>' \
  --env 'PARENT_URL=https://app.pubhubs.net' \
  -p 8800:8800 \
  registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:stable
```

Replace `<Hub server domain>` with the domain of your Hub server (for example: `hub.librarywebsite.com`).

The client should now be running at localhost:8800, which you can test from the machine that it runs on. In order to be reachable from the outside, a reverse proxy on port 443 with TLS is needed.

## Global and Hub client

The Hub client is in an iframe within the global client which is served from the domain of PubHubs Central (PHC). Its primary purpose is to allow the user to quickly switch between hubs, via a sidebar of icons showing the different accessible hubs.

[&larr; Table of Content](../README.md)
