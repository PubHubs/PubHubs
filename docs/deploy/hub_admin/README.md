# Hub Administration

The hub itself is using [the Synapse server](https://github.com/matrix-org/synapse), for some hints on its administration see the [instructions](synapse_admin.md).

Administrators can also create rooms like public rooms and secured rooms. For more information on secured rooms, see the [PubHubs white paper](http://www.cs.ru.nl/B.Jacobs/PAPERS/pubhubs-idman-jlc.pdf).

## Creating an admin user

### Using the database directly

To create the first admin user, you need to update the homeserver database directly:

1. Navigate to the homeserver database (`homeserver.db`) which is in your `hub_dir` .

2. Make the user admin:

    ```sql
    UPDATE users SET admin = 1 WHERE name = '@abc-123:testhub.matrix.host';
    ```

### Using the Synapse Admin API

Once you have an admin user, you can use the [Synapse Admin API](https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html) to make other users an admin:

```bash
curl -X PUT "https://<hub-server-domain>/_synapse/admin/v2/users/@<user-id>:<server-name>" \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"admin": true}'
```

If you search for token in the network console when logging in as admin into the hub-client you can find the admin-access-token needed for making an admin with the endpoint.

[&larr; Table of Content](../README.md)
