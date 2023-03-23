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

docker run --env VUE_APP_BASEURL=<url-to-hub-server> --env 'BAR_URL=frame-ancestors https://stable.pubhubs.ihub.ru.nl/;'   -p 8800:8800 registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:main
```
