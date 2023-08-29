Before merging to stable, please check the following.

  - [ ] You're merging from main into stable (and not from some feature branch.) 
  - [ ] Check that CI/CD pipeline in main has completed without errors.
  - [ ] Please check that the following works on https://main.pubhubs.ihub.ru.nl/client :
      - [ ] Logging in with your existing account there.
      - [ ] Posting a message to a room, and creating a room.
      - [ ] Registering a *new* user, with fresh Yivi credentials.
      - [ ] Posting a message to a room, and creating a room with this new user.
      - [ ] Sending a private message
      - [ ] Secured room login
      - [ ] Secured room icon changes to shield
      - [ ] Single profile attributes batch should be displayed for secured rooms with profile attribute set to true
      - [ ] No batch should be displayed for secured rooms with profile attribute set to false
      - [ ] No batch in non-secured rooms
      - [ ] Multiple badges for rooms with multiple profile attributes
      - [ ] Change displayname
      - [ ] Change Theme & Language, and see they are stored/fetched after logout/login
      - [ ] Logging out.
      - [ ] Logging out and logging in again with your original user
      - [ ] Anything related specifically to your merge request.
  - [ ] Figure out if the merge also requires any configuration changes. 
  - [ ] Consider if the merge might cause irreverible changes (different database format), and plan for this. (Backups?)
  - [ ] Inform the pubhubs team (via Slack) of the merge and possible downtime of https://stable.pubhubs.ihub.ru.nl/client . 
  - [ ] Make the changes and perform the merge.
  - [ ] Check that the following works on https://stable.pubhubs.ihub.ru.nl/client :
     - [ ] Logging in with your existing account.
     - [ ] Posting an message, and creating a room.
     - [ ] Registering a *new* user, with a fresh email address (if possible).
     - [ ] Posting a message to a room, and creating a room.
     - [ ] Sending a private message
     - [ ] Logging out and in with this new user.
     - [ ] Secured room login
     - [ ] Secured room icon changes to shield
     - [ ] Single profile attributes batch should be displayed for secured rooms with profile attribute set to true
     - [ ] No batch should be displayed for secured rooms with profile attribute set to false
     - [ ] No batch in non-secured rooms
     - [ ] Multiple badges for rooms with multiple profile attributes 
     - [ ] Anything related specifically to your merge request.
     - [ ] Change displayname
     - [ ] Change Theme & Language, and see they are stored/fetched after logout/login
     - [ ] Logging out
  - [ ] If there are problems:  fix or revert, if possible.
  - [ ] Otherwise, celebrate!

     
  (The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/merge_request_templates/merge-to-stable.md).)
