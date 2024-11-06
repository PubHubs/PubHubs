# Client settings

> These are instructions to setup and run the Hub client. We assume that you already have the Hub server up and running. And, as such, that you have received some confidential information from PubHubs Central which you need here. See [Hub server instructions](../hub/README.md).

- If not done for the Hub already, login with the access token received in a confidential file

```shell
docker login registry.science.ru.nl -u <requiredbutnotused> -p <access token>
```

- Fetch the client container

```shell
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:stable
```

- Run the client

```shell

docker run --env 'BAR_URL=frame-ancestors https://app.pubhubs.net;' --env 'HUB_URL=https://<Hub server domain>' --env 'PARENT_URL=https://app.pubhubs.net'  -p 8800:8800 registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:stable
```

`<Hub server domain>` is the domain of the associated Hub server, which you provided when setting up the Hub server (for example: `hub.librarywebsite.com`).

The client should now be running at localhost:8800, which you can test from the machine that it runs on. In order to be reachable from the outside, some sort of reverse proxy on port 443 with TLS is needed.

[&larr; Table of Content](../README.md)

## Global and Hub client
The Hub client is in an iframe within the global client which is served from the domain of PubHubs Central (PHC). Its primary purpose is to allow the user to quickly switch between hubs, via a sidebar of icons showing the different accessible hubs. 
