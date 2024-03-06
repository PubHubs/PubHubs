## Changes to main, not yet committed to stable
*Please add a brief description of any changes to be tested and any migrations to be performed here.*

- Several changes to Synapse `homeserver.yaml` configuration, including a `ConfigChecker` module that
  will crash synapse to tell you what changes to make.

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




