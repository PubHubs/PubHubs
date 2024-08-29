## Changes to main, not yet committed to stable

*Please add a brief description of any changes to be tested and any migrations to be performed here.*
- Changed syncing of showing or hiding the bar between hub an global client. Also streamlined the message box start-up together with it. Changed it so the homepage of a hub does not keep the room id in the url fragment if it was there.

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




