# Admin and Synapse #

This is about server administration, with a focus on setting up specific PubHubs functionality (secured rooms).

## Setting up the server ##
See [the readme](README.md).

*Needs:*
- Set-up guide.
- Example `homeserver.yaml`.

## Becoming an admin ##
After setting up a hub, existing users can be made an admin by manipulation the database directly [according to the documentation](https://matrix-org.github.io/synapse/latest/usage/administration/admin_api/index.html#authenticate-as-a-server-admin).
This is fair enough for now. 

This is about *server* admins not *room* admins.

*Needs:*
- Documentation, as a step in the set-up guide.

## General admin possibilities ##

[Synapse documentation](https://matrix-org.github.io/synapse/latest/usage/administration/index.html) should be good.

*Needs:*
- Quick check if enough or we should add specific instruction, for example which best practices we recommend or which you cannot really use with PubHubs.

## Specific PubHubs admin powers ##

Can we check for admin access_tokens in modules? That would be easy. `ModuleAPI::get_user_by_req` returns a `Requester` 
that has a user_id we can use with `ModuleAPI::is_user_admin` to see if someone is a server admin.

*Needs:*
- Instructions for our modules, should be part of the set-up guide.
- Move secured rooms set-up from `homeserver.yaml` to an admin accessible API, basically CRUD, I guess. Can add the threaded rooms as an option here.
- Expiring access to secured rooms based on expiry date of IRMA credentials.
- Better way to get QR code to users: basically integration with our new front-end.

*Slightly more long term:*

Specific attributes only in one room:
- Research how to be totally sure the revealed attributes do not leave the room, don't forget federation!
- Add to admin CRUD api for configuration of existing rooms.
- Some way to get the IRMA QR to the end-user.
- Expiry dates?

## Non admin related work ##

We need tagged rooms to distinguish them, also room creation by users but
certainly for the secured rooms.

The general idea for naming will be: 

Add `{"type": "ph.< messages | threading >.restricted"}` [when creating a room in this way through the new admin API](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/blob/main/pubhubs_hub/modules/pubhubs/IrmaRoomJoiner.py#L141)
and convention will be: ph.threading.< visbility > vs ph.messages.< visibilty >. For thread vs. chat rooms.
With so far visibility either 'public' or 'restricted' (for rooms wiht IRMA requirements). 


*Needs:*
- Specific room type for the secured rooms -> the highest priority, but needs the PH-ADMIN API since current set-up of rooms is before changing the config.
