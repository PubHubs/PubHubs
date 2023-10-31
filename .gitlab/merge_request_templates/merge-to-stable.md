Before merging to stable, please check the following.

As a general tip while testing, keep two browser windows open, one for a existing user (it's easiest if this is a hub admin), and an incognito one for a new user that will be registered during testing. This allows seeing messages being send and easier testing.
  - [ ] Check that CI/CD pipeline in main has completed without errors. If the pipeline is blocked, then manually run all the stages to ensure that there is no error. This might take a bit of time therefore, this should be the first step for the merge to stable.
  - [ ] You're merging from main into stable (and not from some feature branch.) 
  - [ ] Review and update the [CHANGELOG](CHANGELOG.md) to reflect the state after the merge into stable.
    - [ ] Scan through all changes in merge request to see if there is any issue.
  - [ ] Update dependencies, see #227
  - [ ] Below proceeding with the folloing steps please check that the pipeline has been successfully completed. 
  - [ ] Please check that the following works on https://main.pubhubs.ihub.ru.nl/client :
      - [ ] Logging in with your existing account there.
      - [ ] Posting a message to a room.
      - [ ] Creating a new room as an admin user. 
      
        To make yourself a hub admin: 
         - log into ilab@ilab-main.cs.ru.nl using the [id_ilab](https://gitlab.science.ru.nl/ilab/ops/-/blob/main/ssh/id_ilab?ref_type=heads) key, via yourscienceaccountname@lilo.science.ru.nl, see e.g. https://gitlab.science.ru.nl/ilab/ops/-/blob/main/ssh/config?ref_type=heads)
          - `cd /data/testhub-matrix-main/data`
          - `sudo sqlite3 homeserver.db`
          - `UPDATE users SET admin=1 WHERE name="@XXX-XXX:main.testhub-matrix.ihub.ru.nl";`, where `XXX-XXX` should be replaced by your short pseudonym.
          - `.quit`, etc.
      - [ ] Creating a new secured room as an admin user.
      - [ ] Registering a *new* user, with fresh Yivi credentials.
      - [ ] Posting a message to a room with this new user.
      - [ ] Sending a private message.
      - [ ] Secured room login.
      - [ ] Secured room icon changes to shield.
      - [ ] Single profile attributes badge should be displayed for secured rooms with profile attribute set to true.
      - [ ] No badge should be displayed for secured rooms with profile attribute set to false.
      - [ ] No badge in non-secured rooms.
      - [ ] Multiple badges for rooms with multiple profile attributes.
      - [ ] Change displayname.
      - [ ] Change Theme & Language, and see they are stored/fetched after logout/login.
      - [ ] Logging out.
      - [ ] Logging out and logging in again with your original user.
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
     - [ ] Posting a message to a room.
     - [ ] Sending a private message.
     - [ ] Logging out and in with this new user.
     - [ ] Secured room login.
     - [ ] Secured room icon changes to shield.
     - [ ] Single profile attributes badge should be displayed for secured rooms with profile attribute set to true.
     - [ ] No badge should be displayed for secured rooms with profile attribute set to false.
     - [ ] No badge in non-secured rooms.
     - [ ] Multiple badges for rooms with multiple profile attributes .
     - [ ] Anything related specifically to your merge request.
     - [ ] Change displayname.
     - [ ] Change Theme & Language, and see they are stored/fetched after logout/login.
     - [ ] Logging out.
  - [ ] Make issues for the problems. If they are serious:  fix or revert, if possible.
  - [ ] Merge stable back into main. To check if main and stable are merged correctly, go to the [repository graph](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/network/main?ref_type=heads) and check if main and stable are pointing to the same commit. See the screenshot below.

  ![image](/uploads/478c467465270fe24b4e3ec6ee32cc3b/image.png)
  - [ ] Otherwise, celebrate!

     
  (The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/merge_request_templates/merge-to-stable.md).)

