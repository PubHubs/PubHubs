# Updating dependencies

Please make seperate commits for every step with descriptive commit messages. So that if an update breaks something, we can revert the commit.  For major updates, also make a seperate commit for every dependency.
Also make sure to not squash the commits so we can search for them later.

## PubHubs central
### Rust
 - [ ] In the `pubhubs` directory, run `cargo update -v` to install updates that are likely backwards compatible. 
 - [ ] *If* you are familiar with the rust code, check for (and likely breaking) major releases using `cargo update -v` and adjust `Cargo.toml` (and the code) accordingly.

## Hub
 - [ ] Check the version numbers in the [hub Dockerfile](pubhubs_hub/Dockerfile):
   - [ ] update synapse **In version 1.120, authenticated media (see #937) will be enforced. Our client is not ready for that, but we can disable authenticated media in the configuration for now, see the [upgrade notes](https://element-hq.github.io/synapse/v1.120/upgrade.html#authenticated-media-is-now-enforced-by-default)**:
     - [ ] `FROM ghcr.io/element-hq/synapse:vXXXX` see [synapse releases](https://github.com/element-hq/synapse/releases)
     - [ ] `matrix-synapse==XXXX` in [python dependencies file](pubhubs_hub/requirements.txt) should be same version as synapse in dockerfile. 
   - [ ] `git clone https://github.com/privacybydesign/irmago --branch vXXXX` see [yivi releases](https://github.com/privacybydesign/irmago/releases)
   - [ ] `FROM golang:<debian_version>` The [debian_version](https://www.debian.org/releases/stable/) should be the same for both golang and rust and the same as the version on which the synapse image is based. This is to prevent errors like to avoid errors like "OSError: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.33' not found (required by /usr/lib/libpubhubs.so)".
   - [ ] `FROM rust:<debian_version> AS libpubhubs_build`


## Global Client

For reference, dependencies are in `package.json`.

- [ ] In the `global-client` directory, run `npm update` to install minor version updates (probably non-breaking changes).
- [ ] Run `npm outdated` to check for major updates (difference between wantend and latest) and change the package.json file to update major versions if wanted. 
  - **NOTE** Don't update tailwind-merge and tailwindcss until #1073 has been fixed.
  - 2024-nov: Mo:  could not update `eslint` related packages
  - 2024-sept: laura:  could not update `eslint` related packages
  - 2024-sept: `vuedraggable`'s latest, `2.24.3`, seems off, as the current is `4.1.0`; not updated.
- [ ] To address issues that do not require attention, run: `npm audit fix`
  - (2024-jul) This gives a warning about @vue/cli-service@3.3.1. You can ignore this as running npm audit fix --force breaks more things.
  - (2024-jul) updating 'msw' to 2.3.3 breaks the tests when its ran on gitlab. If it's not fixed in 2024-oct, make an issue at msw repo.
- [ ] To address issues with breaking changes, check them and solve them if possible.

## Hub Client

For reference, dependencies are in `package.json`.

- [ ] Check the version number in the [`Dockerfile`](hub-client/Dockerfile): `FROM XX-slim`.  (You can find a list of tags [here](https://hub.docker.com/_/node/tags?name=slim).)
- [ ] In the `hub-client` directory, run `npm update` to install minor version updates (probably non-breaking changes).
- [ ] Run `npm outdated` to check for major updates (difference between wantend and latest) and change the package.json file to update major versions if wanted.
  - **NOTE** Don't update msw until #978 has been fixed.
  - **NOTE** Don't update tailwind-merge and tailwindcss until #1073 has been fixed.
- [ ] To address issues that do not require attention, run: `npm audit fix`
  - (2024-jul) This gives a warning about @vue/cli-service@3.3.1. You can ignore this as running npm audit fix --force breaks more things.
- [ ] To address issues with breaking changes, check them and solve them if possible.

## Yivi docker
 - [ ] Check the version numbers in the [yivi Dockerfile](docker_yivi/Dockerfile)
   - [ ] `FROM golang:XXX`
   - [ ] `git clone https://github.com/privacybydesign/irmago --branch vXXXX` Please check that you've selected the same version as in the [hub Dockerfile](pubhubs_hub/Dockerfile).
 - [ ] Also check the version number in https://gitlab.science.ru.nl/ilab/docker-build/-/blob/main/.gitlab-ci.yml: `docker build -t ${CONTAINER_IMAGE} https://github.com/privacybydesign/irmago.git#vXXX`

  (The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/issue_templates/update-dependencies.md).)

