Before merging to stable, please check the following.

General tips:

- While testing, keep two browser windows open, one for a existing user (it's easiest if this is a hub admin), and an incognito one for a new user that will be registered during testing. This allows seeing messages being send and easier testing.
- If you do the merge together with a collegue, one of you should do the tests on an mobile phone and the other on a desktop.

  - [ ] Notify the others that they do not merge anything into main until the merge to stable is done. (otherwise you will merge changes that may not be deployed to main and therefore not tested by the steps below).
  - [ ] You're merging from main into stable (and not from some feature branch.) 
  - [ ] Review and update the [CHANGELOG](CHANGELOG.md) to reflect the state after the merge into stable.
    - [ ] Scan through all changes in merge request to see if there is any issue.
    - [ ] Set the new version number  ([how to decide which version](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Tech-Information/Versioning)) in the [CHANGELOG](CHANGELOG.md). **But don't tag yet!** Tagging will release a new stable version. (You can see the tags and their pipelines [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/tags).)
  - [ ] Before proceeding with the following steps please check that the pipeline has been succeeded. 
  - [ ] Consider if the merge might cause irreversible changes (different database format), and plan for this. (Backups?)
  - [ ] Please check that the following works on https://main.pubhubs.ihub.ru.nl/client :
      - [ ] Test basic pubhubs functionality
        - [ ] Open two (private) browser windows and:
          - [ ] Log in with an existing admin user.
          - [ ] Register a *new* user, with fresh Yivi credentials.
                
          To make yourself a hub admin: 
            - log into ilab@ph.ru.nl using the [id_ilab](https://gitlab.science.ru.nl/ilab/ops/-/blob/main/ssh/id_ilab?ref_type=heads) key, via yourscienceaccountname@lilo.science.ru.nl (see also [the wiki](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Infrastructure))
            - `cd /data/testhub-matrix-main/data`
            - `sudo sqlite3 homeserver.db` (could be that you need to install sqlite3 first, it will say how to)
            - `UPDATE users SET admin=1 WHERE name="@XXX-XXX:main.testhub-matrix.ihub.ru.nl";`, where `XXX-XXX` should be replaced by your short pseudonym.
            - `.quit`, etc.
        - [ ] With the admin user:
          - [ ] Go to an existing room with many messages, scroll around, post a message. Make sure you see everything that should be there.
          - [ ] Use the search functionality
          - [ ] Create a new room
          - [ ] Create one or more new secured room with mulitple profile attributes and a non profile attributes.
            - Make sure to require at least one value, so that one of the users cannot enter the secured room.
            - Check if the badges are shown properly (in line with which (non-)profile attributes are set).
            - Try to vary a bit in what you do exactly on each merge.
          - [ ] In general act like a regular PubHubs user and try and see if everything works as expected.
          - [ ] Make an announcment to the room.
        - [ ] With the new user (not an admin!):
          - [ ] Send a message in the public room.
          - [ ] Send a message in the secured room (if you are admin, you can allways enter a secured room, so important to test this with a normal user).
          - [ ] Sending a private message.
          - [ ] Send a message with an image file and a message with another file (ie PDF or txt or docx).
          - [ ] Leave one of the secured rooms. And re-enter that room.
        - [ ] Change displayname and avatar.
        - [ ] Change Theme & Language, and see they are stored/fetched after logout/login.
        - [ ] Logging out and logging in again with your original user.
        - [ ] Create a poll and date picker, check if other users can see the update of the poll and datepicker.
      - [ ] Anything related specifically to your merge request.
  - [ ] Given all the issues found, decide whether it's prudent to continue the merge.  (That is, are the bugs bearable.) Consider consulting with other colleagues.
  - [ ] Figure out if the merge also requires any configuration changes.
  - [ ] Update feature flag for stable if the feature works properly.
  - [ ] Inform the pubhubs team (via Slack and PubHubs stable) of the merge and possible downtime of https://stable.pubhubs.ihub.ru.nl/client . 
  - [ ] Make the changes and **perform the merge** (don't squash commits). After merging, **tag** the latest commit on stable with the version number plus `-rc0` (e.g. `v1.2.3-rc0`) to trigger the building and publishing of the stable images. 
  - [ ] While waiting on the pipeline: update dependencies on the main branch in a merge request created from [this issue](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/issues/new?issuable_template=update-dependencies&issue[title]=Updating%20dependencies%20on%2020yy-mm-dd). Please wait with merging this, see instruction below.
  - [ ] Check that the following works on https://app.pubhubs.net :
    - [ ] Turn off dev mode in Yivi app. 
    - [ ] Test basic pubhubs functionality (see above)
      - Note for registering a *new* user, with a fresh email address: If possible, tips are if you have a gmail account you can add +<date> before the '@' and add a card for that, if you have a mail domain with a catch-all you can create a new mail address and add a card for that.
    - [ ] Anything related specifically to your merge request.
  - [ ] Make issues for the problems. If they are serious:  fix or revert, if possible.
  - [ ] If everything is fine:  tag with the actual version number, e.g. `v1.2.3`, replacing the release candidate with the proper version number.  (Check the deployment succeeded.)
  - [ ] Merge stable back into main. Do this on your machine, not via a gitlab merge request (which will make an extra commit leading to out-of-sync main and stable). To check if main and stable are merged correctly, go to the [repository graph](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/network/main?ref_type=heads) and check if main and stable are pointing to the same commit. See the screenshot below. (If you already merged the updated dependencies to main, main will be ahead of stable)

  ![image](/uploads/478c467465270fe24b4e3ec6ee32cc3b/image.png)
  - [ ] Merge the branch with the updated dependencies to main. We do this now because otherwise the main and stable will not point to the same commit as shown in the repository graph.
  - [ ] Check this list and cleanup items with due date passed, and add due dates to items that are not in active development anymore.
       
  - [ ] If Frans Lammers is not available, email [external hubs](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Tech-Information/External-Hub-Deployment) to pull the latest updates with the following email:

> Dear XYZ,
> 
> I hope this email finds you well.
> 
> I am writing this email to inform you that our latest update is now available. We kindly ask you to pull the update to ensure that you have access to the recent features and bug fixes.
> Please do not hesitate to reach out to us if you encounter any issue during the update process.
> 
> Regards,
>
> PubHubs Team

(The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/merge_request_templates/merge-to-stable.md).)
  - [ ] Celebrate!
