# Hub Configuration

> These settings are important for Hub Owners

Hub Owner will make a contract with Central Platform by providing their information such as Hub Name, Hub Description and Redirection URI by email. This will allow Central Platform to issue a confidential file to the Hub Owner.

<img src=../../pictures/key-exchange.png alt="drawing" width="3000"/>

In order to register a hub with the central platform. The Hub owner needs to make a contract with the Central Platform. On agreement, the adminstrator will provide a confidential file with decrpytion key, client id and client password in a secure manner via PostGuard.

On receiving the confidential information, the hub owner will need to perform the following tasks for setting up the Hub.

-   The `decryption key` is used as an environment variable `HUB_SECRET` when running the container for Hub.

-   The client ID and client password are used `client id` and `client password` are used in the homeserver configuration file `homeserver.yaml`. See the snippet below:

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

> A minimum sample file is provided in the `hub/` directory of this documentation

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

-   Change permission on the `hub/` folder and its subdirectory.

```shell
chmod -R 777 hub
```

```shell
docker run -p 8008:8008 --mount "type=bind,src=<absolute_path>/hub,dst=/data"  -e HUB_SECRET=<decryption_key> -e SYNAPSE_CONFIG_DIR=/data registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_hub:main
```

## Terms and conditions for the Hub

A `templates` directory can be created specifying the terms and conditions of the Hub. See sample in pubhubs repository `pubhubs_hub/matrix_test_config/templates`.

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
    [Client Instructions &rarr;](../client/README.md)
