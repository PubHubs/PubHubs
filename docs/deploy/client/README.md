# Client settings

> These instructions for pubhubs client assumes that you have already received the token to fetch the container of client. This practice of authentication for fetching PubHub container and client running on port 8800 which change in the future.

- Login with the token received in a confidential file

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
