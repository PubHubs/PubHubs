# Client settings

> These instructions for pubhubs client assumes that you have already received the token to fetch the container of client. This practice of authentication for fetching PubHub container and client running on port 8800 will change in the future.

- If not done for the hub already, login with the token received in a confidential file

```shell
docker login registry.science.ru.nl -u <username> -p <token>
```

- Fetch the client container

```shell
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:main
```

- Run the client

```shell

docker run --env 'BAR_URL=frame-ancestors https://<central_platform_url>;' --env 'HUB_URL=https://<hub_url>' --env 'PARENT_URL=https://<central_platform_url>'  -p 8800:8800 registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:main
```

`<central_platform_url>` is the url of the global client since the client needs to be embedded in it.

`<hub_url>` is the url of the associated hub of the client.

The client should now be running at localhost:8800, which you can test from the machine that it runs on. In order to be reachable from the outside, some sort of reverse proxy on port 443 with TLS is needed.

[&larr; Table of Content](../README.md)

## Global and Hub client
The Hub client is in an iframe within the global client which is served from the domain of PubHubs Central (PHC). Its primary purpose is to allow the user to quickly switch between hubs, via a sidebar of icons showing the different accessible hubs. 