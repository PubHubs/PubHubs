# Hub Administration

The hub itself is using [the Synapse server](https://github.com/matrix-org/synapse), for some hints on its administration see the [instructions](synapse_admin.md).

Administrators can also create rooms like public rooms and secured rooms. For more information on secured rooms, see the [PubHubs white paper](http://www.cs.ru.nl/B.Jacobs/PAPERS/pubhubs-idman-jlc.pdf).

## Creating an admin user

There is no admin user to start with, so the first one has to be made by editing the hub database directly. Only that first admin has to be made this way; every admin after that can be made with the Synapse Admin API.

A user only exists in the database after logging in on the hub at least once, so log in with the account you want to make admin before you start.

### Using the database directly

Hubs run an embedded PostgreSQL database inside the hub container, so the database is reached through `docker exec` rather than through a file in `hub_dir`.

1. Open a `psql` shell on the `hub` database inside the running hub container:

    ```shell
    docker exec -it <hub-container> sudo -u postgres psql hub
    ```

2. Make the user admin:

    ```sql
    UPDATE users SET admin = 1 WHERE name = '@abc-123:testhub.matrix.host';
    ```

    If you do not know the exact user id, `SELECT name FROM users;` lists them.

3. Leave the `psql` shell with `\q`, and restart the hub container so it picks up the change.

#### Hubs still on sqlite3

Hubs that have not been migrated to PostgreSQL yet (see the [changelog](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/blob/stable/CHANGELOG.md)) keep their database in the `homeserver.db` file in your `hub_dir`. There, use `sqlite3` instead:

```shell
sqlite3 <path_to_hub_dir>/homeserver.db
```

The `UPDATE` statement above is the same; quit with `.quit` and restart the hub container.

If `hub_dir` contains a `homeserver.db.bak`, the hub has already been migrated and PostgreSQL is the live database: editing `homeserver.db.bak` has no effect.

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
