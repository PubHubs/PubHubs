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
      config:
```

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

A `templates` directory can be created specifying the terms and conditions of the Hub. See sample in pubhubs repository `pubhubs_hub/matrix_test_config/templates`. The template directory can be used for styling the hub. A sample template directory can be found in `pubhubs_hub/matrix_test_config/templates`. Copy this template directory in <absolute_path>/hub (path mounted in docker run). Update the test_hub.log.config file with the one present in the template directory `docs/deploy/test_hub.log.config`.

## Hub administration

The hub itself is using [the Synapse server](https://github.com/matrix-org/synapse), for some hints on its administration see the [instructions](synapse_admin.md).

Administrator can also created rooms like secured rooms. At the moment, we do not have
a admin panel. However, secured rooms can be created by admin users by following the
following steps:

Create a admin user: You can make an existing user an admin user by updating the homeserver database.

-   Login to the homeserver database which is in `/pubhubs_hub/matrix_test_config`.
-   Make the user admin e.g., `
UPDATE users SET admin = 1 WHERE name = '@abc-123:testhub.matrix.host'`;
-   Restart the Hub. (for local development retart the script.)
-   Grab the access token `<ACCESS TOKEN>` of the admin user from `access_tokens` table.
-   Create the secured room. For example,

```
curl --header "Authorization: Bearer <ACCESS TOKEN>" -H "Content-Type: application/json" -X POST -d '{
	"room_name": "secureroomtest",
	"accepted": {
		"irma-demo.sidn-pbdf.email.email": {
			"accepted_values": [
				"baba@baba.com"
			],
			"profile": true
		}
	},
	"user_txt": "usertx",
	"type": "ph.messages.restricted"
}' http://127.0.0.1:8008/_synapse/client/secured_rooms
```

-   You will need to update the configuration settings in the following files.

    [Homeserver File](../../../pubhubs_hub/matrix_test_config/homeserver.yaml)

    -   Uncomment and change the public_yivi_url: value.

    [Client Config](../../../hub-client/public/client-config.js)

    -   Update the HUB URL e.g., https://localhost:8008/ for local testing.

-   Login with a normal user (Not as an admin user). Search for secured room (e.g., secureroomtest). You will be prompted with a secured room page. Use Yivi app to disclose your attributes (e.g., baba@baba.com).
    
## Secured Room Expiry


An administrator can also setup an expiry time for a secure room. Default value of expiry is 90 days. 
The administrator can setup expiry days when creating a secure room. For example, the administrator can set expiry of a room of 10 days as shown in the example below:



```
curl --header "Authorization: Bearer <ACCESS TOKEN>" -H "Content-Type: application/json" -X POST -d '{
        "room_name": "secured_room",
        "accepted": {
                "irma-demo.sidn-pbdf.email.domain": {
                        "accepted_values": [
                                "gmail.com"
                        ],
                        "profile": false
                }
        },
        "user_txt": "usertx",
        "expiration_time_days": 10,
        "type": "ph.messages.restricted"
}' http://127.0.0.1:8008/_synapse/client/secured_rooms
```
    
FOR TESTING PURPOSE: The key expiration_time_days to a small value like `0.002`. This is around 3 minutes. A sufficient time to observe the removal of secured room from the list. 
    
  [Client Instructions &rarr;](../client/README.md)
