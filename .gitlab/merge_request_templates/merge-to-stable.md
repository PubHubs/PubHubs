Before merging to stable, please check the following.

As a general tip while testing, keep two browser windows open, one for a existing user (it's easiest if this is a hub admin), and an incognito one for a new user that will be registered during testing. This allows seeing messages being send and easier testing.

  - [ ] You're merging from main into stable (and not from some feature branch.) 
  - [ ] Check that CI/CD pipeline in main has completed without errors.
  - [ ] Please check that the following works on https://main.pubhubs.ihub.ru.nl/client :
      - [ ] Logging in with your existing account there.
      - [ ] Posting a message to a room.
      - [ ] Creating a new room as an admin user. (PubHubs runs on iLab-main.cs.ru.nl, see ops repository for keys)
      - [ ] Creating a new secured room as an admin user.
      - [ ] Registering a *new* user, with fresh Yivi credentials.
      - [ ] Posting a message to a room with this new user.
      - [ ] Sending a private message
      - [ ] Secured room login
      - [ ] Secured room icon changes to shield
      - [ ] Single profile attributes badge should be displayed for secured rooms with profile attribute set to true
      - [ ] No badge should be displayed for secured rooms with profile attribute set to false
      - [ ] No badge in non-secured rooms
      - [ ] Multiple badges for rooms with multiple profile attributes
      - [ ] Change displayname
      - [ ] Change Theme & Language, and see they are stored/fetched after logout/login
      - [ ] Logging out.
      - [ ] Logging out and logging in again with your original user
      - [ ] Anything related specifically to your merge request.
  - [ ] Figure out if the merge also requires any configuration changes. 
  - [ ] Consider if the merge might cause irreversible changes (different database format), and plan for this. (Backups?)
  - [ ] Inform the pubhubs team (via Slack) of the merge and possible downtime of https://stable.pubhubs.ihub.ru.nl/client . 
  - [ ] Make the changes and perform the merge. Make sure all the jobs in the pipeline are kicked off. (Some jobs require manual start)
  - [ ] Check that the following works on https://stable.pubhubs.ihub.ru.nl/client :
     - [ ] Turn off dev mode in Yivi app. 
     - [ ] Logging in with your existing account.
     - [ ] Posting an message.
     - [ ] Creating a new room as an admin user.
     - [ ] Creating a new secured room as an admin user.
     - [ ] Registering a *new* user, with a fresh email address (if possible, tips are if you have a gmail account you can add +<date> before the '@' and add a card for that, if you have a mail domain with a catch-all you can create a new mail address and add a card for that).
     - [ ] Posting a message to a room, and creating a room.
     - [ ] Sending a private message
     - [ ] Logging out and in with this new user.
     - [ ] Secured room login
     - [ ] Secured room icon changes to shield
     - [ ] Single profile attributes badge should be displayed for secured rooms with profile attribute set to true
     - [ ] No badge should be displayed for secured rooms with profile attribute set to false
     - [ ] No badge in non-secured rooms
     - [ ] Multiple badges for rooms with multiple profile attributes 
     - [ ] Anything related specifically to your merge request.
     - [ ] Change displayname
     - [ ] Change Theme & Language, and see they are stored/fetched after logout/login
     - [ ] Logging out
  - [ ] If there are problems:  fix or revert, if possible.
  - [ ] Merge stable back into main.
  - [ ] Otherwise, celebrate!

     
  (The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/merge_request_templates/merge-to-stable.md).)

