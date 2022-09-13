# Goal of IrmaRoomJoiner module

Certain rooms will only be accessible after disclosing certain attributes in IRMA, this module makes that possible.

The rooms and the attributes are configured in the synapse configuration.

# Example configuration:
```
#    Below is the example config for adding attribute based authentication to rooms, room id's will be different depending on your server.
#    Make sure to enable server_notices system_mxid_localpart (also in this file) as that will be the user making the waiting rooms.
#  - module: conf.modules.pubhubs.IrmaRoomJoiner
#    config:
#      {
#        # An array of rooms to secure, will have the id of the room plus the attributes in IRMA format. Can provide
#        # accepted attrributes as key-value pairs, leaving 'accepted' empty means any disclosure is accepted.
#        # user_txt will be shown in the widget for the waiting room.
#        # Default invite means users will get a waiting room on registration for the specified room.
#        secured_rooms: [
#           {
#             id: "!wzHbjFuSZTDbbTNAEr:testhub.matrix.host",
#             attributes: ["pbdf.sidn-pbdf.email.domain"],
#             accepted: [pbdf.sidn-pbdf.email.domain: ["ru.nl"]],
#             user_txt: "Please disclose your email here, ru.nl mail addresses will be accepted",
#             default_invite: true
#           },
#           ....
#        ],
#        #  The 2 lines below 2 are optional! More for development than production:
#        # irma_url: "http://172.17.0.1:8089",
#        # irma_client_url: "http://172.17.0.1:8088",
#        #  Client url is necessary for redirection to the room once allowed.
#        client_url: "http://localhost:8800",
#      }
```

# Requirements

Two extra settings in homeserver.yaml are required to make the module work:
- Enable `server_notices` `system_mxid_localpart` to have a user making the waiting rooms
- `public_baseurl` needs to be set to something publically reachable if you want to be able to use the proxied IRMA service. Unless your phone will reach the synapse server on the default public baseurl

As in all matrix settings with docker on mac 'host.docker.internal' works on linux replace with: '172.17.0.1'


# Used endpoints by this module

- /_synapse/client/ph
- /_synapse/client/irmaproxy
