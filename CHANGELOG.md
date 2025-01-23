## Changes to main, not yet committed to stable

*Please add a brief description of any changes to be tested and any migrations to be performed here.*
- Synapse was updated and authenticated media is now enforced by default (see [here](https://element-hq.github.io/synapse/v1.120/upgrade.html#authenticated-media-is-now-enforced-by-default)). We don't support it yet so we disabled it in the Hub configuration. When merging to stable, the new configuration should be added to all running hubs. See also #1025.
- Removed legacy static pages and some of the underlying code, see #1035.

## 21 January 2025 - v1.0.4
- Styling issues fixed #598 #980 #1030 #1017
- New feature - Admin can upload Hub icon #866 (It is behind the feature flag on stable.)
-  Bug fixes #982 #1029

## 9 December 2024 - v1.0.3
- #992, Enter an emoticon is solved.
- #994, Login does not fail anymore when running full local development setup with hub-client in watch-mode.
- #995, It is possible again to change the hub from the global bar on mobile.
- #997, Hub logo fits in its container.
- #1007, Deleting a file/image will give a message that the file is not deleted from the server but not visible anymore to all users.
- #1010, PHC's autodetect does work on ip6 addresses.

## 20 November 2024 - v1.0.2
- Changed the discover room page: Also show rooms user is member of. Shows an arrow to enter these rooms. After joining a room an arrow will be shown for entering this room.
- Changed behaviour of global bar and pinning Hubs: When entering a Hub that is not pinned, it wil automatically be pinned to the top.
- Improvements to logging system. Main and stable should show 'trace' logs while only 'info' logs (and higher) should show when running locally.
- Feature flags are now configured for main and stable. The features are enabled/disabled automatically when running on main or on stable.

## 6 November 2024 - v1.0.1
- Added the option for users to delete their messages. This feature is behind a feature flag, which will be disabled on stable.
- Removes some legacy static pages from Pubhubs Central.
  (These legacy pages can be re-enabled by setting `hotfixes` -> `legacy_static_pages` to true in PHC's configuration.)
- Changed the feature flag system in the frontend, so we don't need to change any code for the merge to stable.

## 17 October 2024 - v1.0.0

- Internal improvements to the room timeline
- Adds version prometheus metric and '\_synapse/client/.ph/info' endpoint via a new 'Core' module.
  WARNING: this requires an update of the hub's homeserver.yaml
- Updated icons global and hubclient
- Added a new page where you can browse and search specific rooms.
- Hubs (in the global bar) show the amount of unread messages

## 26 September 2024 - v0.5.1
- Avatar update issue: other users can also see the update when an Avatar is updated by the user.
- Search for private messages issue: users can be found by searching either their pseudonym or their username.
- Changed the registration flow: added a wizard to guide users through the registration process.

## 11 September 2024 - v0.5.0
- Changed syncing of showing or hiding the bar between hub an global client. Also streamlined the message box start-up together with it. Changed it so the homepage of a hub does not keep the room id in the url fragment if it was there.
- Changed the search results: when there are more results than the ten initially in the list, a text 'Load more results...' is shown to load 10 more results
- User's display name can be updated without refresh. Other users can also see the change now when the display name is updated by the user.

## 28 August 2024

  _nothing in particular_

## 15 August 2024

  _nothing in particular_

## 24 July 2024
- app.pubhubs.net and main.pubhubs.ihub.ru.nl added to 'sso -> client_whitelist' in default homeserver.yaml and config_checker
- Changed contained data of PHC Yivi QRs, so they can be scanned with camera and Yivi app.

## 7 July 2024
- Added global client to sso whitelist in synapse default config. The config checker will crash Hubs that do not have this setting.

## 30 May 2024
- Some changes to styling of displayed hubs in global client.
- Moved synapse login from hub client to global client. Since access to local storage is not always reliable in an iframe. It looks to get even more restricted in the future.

## 9 May 2024
- Add notifications and mentions in a better way.

## 30 Apr 2024
- Refactured a lot for performance issues, pleas check the 'Restricted' room on stable. Does it has errors in the console? (see #634,#590,#636)
- Removed the normalization of display names (i.e. adding the " - 123-abc" suffix)
- Added yivi token format check during login and when entering secure rooms (see #510)
- Changes related to rendering the room timeline (see #454 and #606).
- Remove limit for getting public rooms to not have missing rooms. Might impact performance with high number of public rooms (#605).
- Add eventlisteners to the client sooner to accept invitations to private rooms that happened while offline (#640).

## 27 Mar 2024
- Several changes to Synapse `homeserver.yaml` configuration, including a `ConfigChecker` module that
  will crash synapse to tell you what changes to make.  Please check login, registration, and anything
  related to secure rooms carefully.

## 28 Feb 2024
- New PHC session cookies to solve a CRSF, see #514.

  If you use your own `config.yaml` for local development, you'll probably want to
  copy this snippet from `default.yaml`:
  ```
  hotfixes:
    no_secure_cookies: true # browsers should allow secure cookies on insecure localhost, but they don't
  ```

## 1 Feb 2024
- Styling improvements: #174, #316, #370, #385
- Migration to new vm: #466
- First draft of plugin system: #204

## 14 Dec 2023
- Improvements to the PubHubs yivi registration cards, see !266.
- Scrolling functionality in room timeline: !231
- Styling update for message input: #348
- Feature: @mention functionality: #311

## 13 Nov 2023
- Bug fixes: #393, #381, #317, #373
- New features:  #383, #109, #151

## 31 Oct 2023
- #163 Responsive mobile styling.

## 18 Oct 2023
- New PubHubs Yivi cards, see #162.  Users will have to re-register with PubHubs Central. If they use the same email address and phone number as before, they'll keep their old account.
- File upload was tweaked, see #233 (known issues: #347)
- When a message is not sent due to connectivity loss, a retry button is shown, see #293
- Avatars were added, see #139 (known issues: #350)




