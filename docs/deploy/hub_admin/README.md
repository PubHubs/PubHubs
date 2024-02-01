## Hub Administration 

## Hub administration

The hub itself is using [the Synapse server](https://github.com/matrix-org/synapse), for some hints on its administration see the [instructions](synapse_admin.md).

Administrator can also create rooms like public rooms and  secured rooms. For more information on secured rooms. See [PubHubs white paper ](http://www.cs.ru.nl/B.Jacobs/PAPERS/pubhubs-idman-jlc.pdf) 

Create a admin user: You can make an existing user an admin user by updating the homeserver database.

-   Login to the homeserver database (`homeserver.db`) which is e.g., in `/data` directory` or  `/pubhubs_hub/matrix_test_config`.
-   Make the user admin e.g., `
UPDATE users SET admin = 1 WHERE name = '@abc-123:testhub.matrix.host'`;
-  :exclamation:Local development retart the python script. Not for real deployment of PubHubs.
    
## Secured Room Expiry


An administrator can also setup an expiry time for a secure room. Default value of expiry is 90 days. 
The administrator can setup expiry days when creating a secure room. For example, the administrator can set expiry of a room of 10 days as shown in the example below:

[&larr; Table of Content](../README.md)