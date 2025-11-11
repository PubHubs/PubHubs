_Please add a brief description of any changes and any migrations to be performed here. And use these prefixes before the description:_

- _[BUG] - If the change is a bugfix (from own branch)_
- _[FIX] - If it is a small bug (typo or styling) that is done directly on main or stable_
- _[TYPO] - If a translation/typo in the UI has been changed or implemented_
- _[NEW] - If it is a new feature_
- _[UPDATE] - Updated dependencies_
- _[MIGRATE] - If it is/has a change to a database. Describe the way the migrate is done._
- _[BREAKING] - If it is a breaking change that needs changes done on the deployment/installation/settings_
- _(Use the [MIGRATE] and [BREAKING] prefixes together with another one if that makes more sense.)_

## Changed not yet merged to stable

- [NEW] Reintroduces pubhubs card
  *Internal:*: pubhubs card attributes with `not_addable_by_default = true` need to be added to `pubhubs.toml`, as well as a `[auth.yivi.card]` section.
- [NEW] Direct url links to room and pages in the hub-client still redirect after the login or registration flow.
- [BUG] Fixed direct url links to rooms and pages not working in hub-client
- [BREAKING] The old pubhubs server (that served the global client) has been removed
  - _Internal:_ the entry for `app.pubhubs.net` in `/data/caddy/Caddyfile` needs to be adjusted after merge
- [NEW] The development setup has been simplified, see `maskfile.md`
- [BUG] The login page is no longer visible for a split second upon a refresh when logged in.
- [NEW] The login and home (hub discovery) page are now split.
- [NEW] The synchronization with the server changed from API calls to the Sliding Sync implementation.
- [BUG] Made the front-end code for the multi-server setup more robust (e.g., added checks whether a user is logged in before certain actions like ordering hubs can be performed).
- [BUG] The entire hub icon in the global bar is now clickable (including the part covered by the unread message counter).
- [BUG] Error responses from PHC, the Authentication Server and the Transcryptor are now correctly parsed.

## 11 September 2025 - v3.0.0

- [BREAKING] The old pubhubs server now needs a PHC_URL environment variable pointing to the new mss phc for the global client
- [NEW] Added the option to remove attribute values from existing secured rooms.
- [NEW] Updated validation for the form that is used to edit rooms.
- [NEW] Fast reactions on message.
- [BREAKING] Added `phc.global_client_url` to `pubhubs.toml`.

## 10 July 2025 - v2.2.0

- [UPDATE] Replaced vue.cli by Vite
- [BUG] Avatars where not visible sometimes. Refactured Avatar system.
- [NEW] Message can be added to a image or file in the chat
- [NEW] Added a markdown editor for hub description, house rules, and contact information
- [NEW] List of the members of a room can be shown now (button in header of the room)
- [UPDATE] Transfer of ownership of room by Hub administrator

## 12 June 2025 - v2.1.3

- [BUG] The search bar in rooms now covers the entire width of the screen on mobile devices.
- [BUG] Searching users for direct messages
- [NEW] Handling many admins for creating direct contact
- [FIX] Some styling issues
- [TYPO] The search bar in the emojipicker showed the text "Search for rooms", instead of "Search".

## 5 June 2025 - v2.1.2

- [FIX] Fixed that new users can not join old hubs because of a missing consent version number

## 28 May 2025 - v2.1.0

- [NEW] We improved the registration flow
- [NEW] Users can create group rooms.
- [NEW] Users can contact Hub administrator.
- [FIX] Users can enter public rooms after they have joined it.
- [NEW] New discover rooms design with member count, time of last activity and secured attributes.
- [NEW] New onboarding and consent page of which the contents can be edited in the hub settings.
- [FIX] Some buttons no longer had a background color.
- [NEW] Users are now provided with instructions to install PubHubs as a Progressive Web App (PWA) after they are logged in.
- [BUG] Rooms sometimes appeared to be empty, when they were not loaded correctly

## 15 May 2025 - v2.0.6

- [NEW] There is now a max length for the summary text with a max word counter to keep track
- [BUG] In the hub description words were split between 2 lines
- [FIX] The size of the icons on the badges for secured rooms was too large

## 01 May 2025 - v2.0.5

_NOTE:_ Tag (v.2.0.3 and v.2.0.4) was updated couple of times due to some issues identified after each tag was added.

- [NEW] New update_config script now checks the configuration in homeserver.yaml and also adds missing configuration , it supersedes the configchecker
  It will generate a checked and updated yaml file as homeserver.live.yaml as default and will use this new yaml file to set the configuration of the hub
- [TYPO] When no rooms are found on the discover rooms page, the text "no rooms were found" is shown instead of "no hubs were found".
- [NEW] Local development: changed the way `pubhubs` autodetect your IP address, making development behind a NAT possible.
- [BUG] Thread stayed open on changing room
- [BUG] In thread-view the first message could be deleted, forcing the whole thread to be deleted
- [BUG] The roomslist shows loading spinner again and shows rooms while loading
- [BUG] Signed messages are enabled again, making it possible to sign messages using an e-mailaddress.
- [BUG] Files, signed messages and the list of users that shows up when mentioning a user have a background color again.
- [BUG] The icon to change the avatar and nickname in a hub is changed back from a cog wheel to a pencil.
- [NEW] Announcements can be made by steward (and room administrator) in rooms.
- [NEW] For the hub a banner, description, summary and contact details can now be set in the hub settings.
  The summary and contact details are displayed on the discover hub page.
  The description and contact details are displayed in the hub homepage.
- [NEW] Datepicker & Pollingwidget. Add a datepicker or poll in your room. Let members choose a date or option.
  _NOTE TO MERGERS:_ The feature flag for voting widgets on stable is currently disabled. If everything works as expected, it needs to be enabled during the merge.

## 03 April 2025 - v2.0.2

_NOTE:_ Tag (v.2.0.0 and v.2.0.1) was updated couple of times due to some issues identified after each tag was added.

- [BUG] Signed messages are temporarily disabled since they were not working as intended
- [NEW] Desktop notifications for new messages are now also sent for pinned hubs when the user has the hub not currently open.
- [NEW] Update and implement Tailwind colors and add minor UX/UI improvements
- [BREAKING] Update feature flag for authenticatedMedia to `true` in hub-client/src/store/settings.ts.
- [BUG] Loading of rooms shows spinner again
- [BUG] Show Hub Settings only to hub admin
- [BUG] Sometimes threads displayed messages in the wrong order

## 20 March 2025 - v1.2.0

- [NEW] Threads are now supported
- [BUG] Error solved when creating/editing rooms with a custom type
- [BUG] Logo backgrounds where vague. Now always white
- [BUG] When a message is deleted, but someone has replied to it, the contents of the deleted message should no longer be visible in the message snippet contained in the reply.
- [TYPO] Changed the text on the discover hub page from "Welcome _at_ PubHubs" to "Welcome _to_ PubHubs".

## 6 March 2025 - v1.1.0

- [FIX] Styling fix where Search on DiscoverRoomPage was partly hidden in Header
- [BUG] Small styling issue solved where hub descriptions will be cut off on bottom.
- [TYPO] 'Unread Messages' was not translated in dutch.
- [NEW] Added 'Discover Rooms' button on HubHomepage.
- [NEW] The settings dialog now includes an option to turn notifications on or off.
- [UPDATE] Files are now uploaded to matrix synaps after clicking submit in the upload forms.
- [NEW] Attributes are now read from a curated list in the yivi.ts file, in the dropdown menu attribute descriptions are shown instead of the attribute value.
- [NEW] Restructured folders of clients.
- [UPDATE] Synapse was updated and authenticated media is now enforced by default (see [here](https://element-hq.github.io/synapse/v1.120/upgrade.html#authenticated-media-is-now-enforced-by-default)). When merging to stable, the new configuration should be added to all running hubs.
- [UPDATE] Code for automatic creation of 'General room' is removed from config (including config check). When merging to stable this config should be removed from 'homeserver.yaml'.
- [NEW] Authenticated media setting in hub configuration can be set to true when merging to stable because Hub client now supports authenticated media.
- [NEW] Adds redirect from https://main.pubhubs.ihub.ru.nl/ to https://main.pubhubs.ihub.ru.nl/client
- [BUG] Searching messages within a room no longer returns empty results.
- [BUG] Right padding of menu-items was off, weird tooltips when hovering over room in menuitem.
- [BUG] Dialog modal on Safari browser did not cover whole screen
- [BUG] Styling of Hub Icon was wrong
- [NEW] Updated the design for the discover hub & login page
- [NEW] Update input bar design & make hotfixes for the button opacity and placeholder text
- [BUG] The hub's welcome page no longer displays an error page when a user has set neither their display name nor avatar.
- [BUG] When scrolling in a room, message no longer partly overlap the message input bar.
- [BUG] The date badge (showing the date of the oldest message in view when scrolling up or the date of the most recent message in view when scrolling down) is centered again and does not cause a horizontal scrollbar to appear.
- [BUG] In the creation of OIDC authorization tokens and handles, replaced message pack by JSON: double check login an registration still works.
- [NOTE TO MERGERS] Changed yivi server on pubhubs VM used by stable and main in anticipation of the new server setup. Changes should be backwards compatible, but if there's trouble with registration/login, this might be the cause. -Bram

## 6 February 2025 - v1.0.5

- The unread message counter for hubs (in the global bar) now also updates upon receiving a new message when the user does not have the hub open.
- Hub admins can now change the hub icon from the hub settings dialog.
- Removed legacy static pages and some of the underlying code, see #1035.
- Hubs are now identified by their hubId in /bar/state and hub access tokens are stored in /bar/state.

## 21 January 2025 - v1.0.4

- Styling issues fixed #598 #980 #1030 #1017
- New feature - Admin can upload Hub icon #866 (It is behind the feature flag on stable.)
- Bug fixes #982 #1029

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
  will crash synapse to tell you what changes to make. Please check login, registration, and anything
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
- New features: #383, #109, #151

## 31 Oct 2023

- #163 Responsive mobile styling.

## 18 Oct 2023

- New PubHubs Yivi cards, see #162. Users will have to re-register with PubHubs Central. If they use the same email address and phone number as before, they'll keep their old account.
- File upload was tweaked, see #233 (known issues: #347)
- When a message is not sent due to connectivity loss, a retry button is shown, see #293
- Avatars were added, see #139 (known issues: #350)
