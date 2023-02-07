# Setting up the Central Platform

### This Guide is only for PubHub Central Platform Administrator only

- Pull Docker image of Central Platform.

```shell
docker pull registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs:main
```

:exclamation: If central platform image with `main` tag is used, then IRMA demo card will be needed for authentication.

- Setting up and running Central Platform container.

```shell
docker run -p 8080:8080 --mount "type=bind,src=<absolute_path>/config,dst=/config" --mount "type=bind,src=<absolute_path>/data,dst=/data" -e PUBHUBS_CONFIG=/config/settings.yml registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs:main
```

`<absolute_path>` should be replaced by the absolute path of your filesystem e.g., `/myuser/project/pubhubs/`

`config` directory contains settings in a yaml file format. See a sample `settings.yml` in `config` directory that contains sample configuration settings.

`data` directory contains policy information regarding the use of Hubs. A sample file is available in the PubHubs repository such as `/pubhubs/default_policies/1`.

> One of the important task for Central Platform administrator is to register the Hub. We see the steps taken by the administrator in the following section.

## Registering the Hub

- Login as administrator by entering the url of Central Platform. For example `https://stable.pubhubs.ihub.ru.nl/login` <mark> Please not that the url and domain name is subject to change. We use this url for demonstration purpose. <mark>.

  <img src=../../pictures/admin-login.png alt="drawing" width="3000"/>

- Register the hub with the central platform by entering the url of Central Platform such as `https://stable.pubhubs.ihub.ru.nl/admin/hubs`.

 <img src=../../pictures/admin-page.png alt="drawing" width="3000"/>

- Fill in the hub name, it description, and redirection URI e.g., `https://<hub-domain-name>/_synapse/client/oidc/callback`. This redirection URI will be provided by the hub owner. The redirection URI is the resource where the users using the client  will be redirected to,  after logging in at the central platform.

- The secret and confidential information about Hub can be downloaded by clicking on the `+`icon under Detail column for each Hub.

<img src=../../pictures/download.png alt="drawing" width="3000"/>

- The confidential information such as hub secret can be downloaded by the administrator and provided to the Hub owner in a secure manner.

> For the moment we leverage [PostGuard](https://postguard.nl/) for secure file sharing.

[Hub Instructions &rarr;](../hub/README.md)
