# Coding steps

- [ ] Followed [coding guidelines](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Contributing/Code-guidelines)
- [ ] Added to [changelog](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/blob/main/CHANGELOG.md) with appropriate prefix and human readable description.
- [ ] Added new e2e tests

# Review Steps:

Before merging to main, check when the merge from main to stable is planned.
If a longer testing time on main for this merge is requested, it is better to merge after the merge to stable is done.

# Tests

All test done with complete PubHubs system. (PHC, minimal two Hubs, Global & Hub clients).

Run the PubHubs e2e test locally (https://gitlab.science.ru.nl/pubhubs/pubhubs-e2e-test).

Let console open to see if there are bugs, warnings etc.
Also good practice: Do the tests on several screensizes (desktop, tablet, phone).

## Test functionility

- [ ] Test the (new) functionality or solved bug.

## Test if something is broken

- [ ] Test basic functionality:
  - [ ] Login
  - [ ] Switch Hubs

## Test UI

- [ ] Test if everything looks as supposed to:
  - [ ] Light theme
    - [ ] PubHubs home
    - [ ] Hubpage home
  - [ ] Dark theme
    - [ ] PubHubs home
    - [ ] Hubpage home
