Before merging to stable, please check the following.

As a general tip while testing, keep two browser windows open, one for a existing user (it's easiest if this is a hub admin), and an incognito one for a new user that will be registered during testing. This allows seeing messages being send and easier testing.
  - [ ] Enable/disable new hub-client features you do/don't want to merge using [feature flags](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/blob/main/hub-client/src/store/settings.ts?ref_type=heads).
  - [ ] Check that CI/CD pipeline in main has completed without errors. If the pipeline is blocked, then manually run all the stages to ensure that there is no error. This might take a bit of time therefore, this should be the first step for the merge to stable.
  - [ ] Notify the others that they do not merge anything into main until the merge to stable is done. (otherwise you will merge changes that may not be deployed to main and therefore not tested by the steps below).
  - [ ] You're merging from main into stable (and not from some feature branch.) 
  - [ ] Review and update the [CHANGELOG](CHANGELOG.md) to reflect the state after the merge into stable.
    - [ ] Scan through all changes in merge request to see if there is any issue.
  - [ ] Before proceeding with the folloing steps please check that the pipeline has been successfully completed. 
  - [ ] Please check that the following works on https://main.pubhubs.ihub.ru.nl/client :
      - [ ] Logging in with your existing account there.
      - [ ] Posting a message to a room.
      - [ ] Creating a new room as an admin user. 
      
        To make yourself a hub admin: 
         - log into ilab@ph.ru.nl using the [id_ilab](https://gitlab.science.ru.nl/ilab/ops/-/blob/main/ssh/id_ilab?ref_type=heads) key, via yourscienceaccountname@lilo.science.ru.nl (see also [the wiki](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Infrastructure))
          - `cd /data/testhub-matrix-main/data`
          - `sudo sqlite3 homeserver.db`
          - `UPDATE users SET admin=1 WHERE name="@XXX-XXX:main.testhub-matrix.ihub.ru.nl";`, where `XXX-XXX` should be replaced by your short pseudonym.
          - `.quit`, etc.
      - [ ] Creating a new secured room as an admin user.
      - [ ] Registering a *new* user, with fresh Yivi credentials.
      - [ ] Posting a message to a room with this new user.
      - [ ] Sending a private message.
      - [ ] Secured room login.
      - [ ] Multiple profile attribute badges should be displayed for secured rooms with multiple profile attributes set to true.
      - [ ] No badge should be displayed for secured rooms with profile attribute set to false.
      - [ ] No badge in non-secured rooms.
      - [ ] Change displayname.
      - [ ] Change Theme & Language, and see they are stored/fetched after logout/login.
      - [ ] Logging out.
      - [ ] Logging out and logging in again with your original user.
      - [ ] Rebrand testhub2 with a new logo and colors. See https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/blob/main/docs/hub_branding/README.md (NB This involves some work on ilab-main, see https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Current-ops-troubleshooting#changing-the-branding-of-a-running-hub)
      - [ ] Anything related specifically to your merge request.
  - [ ] Figure out if the merge also requires any configuration changes. 
  - [ ] Consider if the merge might cause irreversible changes (different database format), and plan for this. (Backups?)
  - [ ] Inform the pubhubs team (via Slack and PubHubs stable) of the merge and possible downtime of https://stable.pubhubs.ihub.ru.nl/client . 
  - [ ] Make the changes and perform the merge. Make sure all the jobs in the pipeline are kicked off. (Some jobs require manual start)
  - [ ] Check that the following works on https://stable.pubhubs.ihub.ru.nl/client :
     - [ ] Turn off dev mode in Yivi app. 
     - [ ] Logging in with your existing account.
     - [ ] Posting an message.
     - [ ] Creating a new room as an admin user.  
     - [ ] Creating a new secured room as an admin user.
     - [ ] Registering a *new* user, with a fresh email address (if possible, tips are if you have a gmail account you can add +<date> before the '@' and add a card for that, if you have a mail domain with a catch-all you can create a new mail address and add a card for that).
     - [ ] Posting a message to a room.
     - [ ] Sending a private message.
     - [ ] Logging out and in with this new user.
     - [ ] Secured room login.
     - [ ] Secured room icon changes to shield.
     - [ ] Multiple profile attribute badges should be displayed for secured rooms with multiple profile attribute set to true.
     - [ ] No badge should be displayed for secured rooms with profile attribute set to false.
     - [ ] No badge in non-secured rooms.
     - [ ] Anything related specifically to your merge request.
     - [ ] Change displayname.
     - [ ] Change Theme & Language, and see they are stored/fetched after logout/login.
     - [ ] Logging out.
  - [ ] Make issues for the problems. If they are serious:  fix or revert, if possible.
  - [ ] Merge stable back into main. Do this on your machine, not via a gitlab merge request (which will make an extra commit leading to out-of-sync main and stable). To check if main and stable are merged correctly, go to the [repository graph](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/network/main?ref_type=heads) and check if main and stable are pointing to the same commit. See the screenshot below.

  ![image](/uploads/478c467465270fe24b4e3ec6ee32cc3b/image.png)
  - [ ] Otherwise, celebrate!
  - [ ] After celebration, update dependencies on the main branch (not on stable as this might break something), see #227
  - [ ] Check this list and cleanup items with due date passed, and add due dates to items that are not in active development anymore.
     
  (The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/merge_request_templates/merge-to-stable.md).)

