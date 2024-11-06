# Updating dependencies

Please make seperate commits for every step with descriptive commit messages. So that if an update breaks something, we can revert the commit.  For major updates, also make a seperate commit for every dependency.
Also make sure to not squash the commits so we can search for them later.

## PubHubs central
### Rust
 - [ ] In the `pubhubs` directory, run `cargo update` to install updates that are likely backwards compatible. 
 - [ ] To check for new major releases (that might break the current code), run [`cargo outdated`](https://github.com/kbknapp/cargo-outdated) (which must be installed first.) 
   Adjust `Cargo.toml` accordingly and check if `cargo test` succeeds.  If you encounter errors, try if you can easily fix them; if not, revert and make an issue.
     - **NOTE:** you may ignore the `cargo outdated` for now;  there are several packages `hyper`, `expry`, `hairy`, used by the old rust code that have major new versions that require quite a rewrite of the old code that is both dangerous and wasteful with the new code coming in. (See #438.)
     - 2024-sept:  `cargo outdated` fails with the error "the package `pubhubs` depends on `env_logger`, with features: `anstream` but `env_logger` does not have these features."

## Hub
 - [ ] Check the version numbers in the [hub Dockerfile](pubhubs_hub/Dockerfile):
   - [ ] update synapse **skip this step until authenticated media is implemented #937**:
     - [ ] `FROM ghcr.io/element-hq/synapse:vXXXX` see [synapse releases](https://github.com/element-hq/synapse/releases)
     - [ ] `matrix-synapse==XXXX` in [python dependencies file](pubhubs_hub/requirements.txt) should be same version as synapse in dockerfile. 
   - [ ] `git clone https://github.com/privacybydesign/irmago --branch vXXXX` see [yivi releases](https://github.com/privacybydesign/irmago/releases)
   - [ ] `FROM golang:<debian_version>` The [debian_version](https://www.debian.org/releases/stable/) should be the same for both golang and rust and the same as the version on which the synapse image is based. This is to prevent errors like to avoid errors like "OSError: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.33' not found (required by /usr/lib/libpubhubs.so)".
   - [ ] `FROM rust:<debian_version> AS libpubhubs_build`
  - [ ] Version number of twisted library in requirements file and python version in CI/CD pipeline script is fixed see #!654. This needs to be updated when the new version of matrix synapse is used. 



## Global Client

For reference, dependencies are in `package.json`.

- [ ] In the `global-client` directory, run `npm update` to install minor version updates (probably non-breaking changes).
- [ ] Run `npm outdated` to check for major updates (difference between wantend and latest) and change the package.json file to update major versions if wanted. 
  - 2024-nov: Mo:  could not update `eslint` related packages
  - 2024-sept: laura:  could not update `eslint` related packages
  - 2024-sept: `vuedraggable`'s latest, `2.24.3`, seems off, as the current is `4.1.0`; not updated.
- [ ] To address issues that do not require attention, run: `npm audit fix`
  - (2024-jul) This gives a warning about @vue/cli-service@3.3.1. You can ignore this as running npm audit fix --force breaks more things.
  - (2024-jul) updating 'msw' to 2.3.3 breaks the tests when its ran on gitlab. If it's not fixed in 2024-oct, make an issue at msw repo.
- [ ] To address issues with breaking changes, check them and solve them if possible.

## Hub Client

For reference, dependencies are in `package.json`.

- [ ] In the `hub-client` directory, run `npm update` to install minor version updates (probably non-breaking changes).
- [ ] Run `npm outdated` to check for major updates (difference between wantend and latest) and change the package.json file to update major versions if wanted.
  - **NOTE** For now, don't update matrix-js-sdk, see #654.
- [ ] To address issues that do not require attention, run: `npm audit fix`
  - (2024-jul) This gives a warning about @vue/cli-service@3.3.1. You can ignore this as running npm audit fix --force breaks more things.
  - (2024-jul) updating 'msw' to 2.3.3 breaks the tests when its ran on gitlab. If it's not fixed in 2024-oct, make an issue at msw repo.
- [ ] To address issues with breaking changes, check them and solve them if possible.

## Yivi docker
 - [ ] Check the version numbers in the [yivi Dockerfile](docker_yivi/Dockerfile)
   - [ ] `FROM golang:XXX`
   - [ ] `git clone https://github.com/privacybydesign/irmago --branch vXXXX` Please check that you've selected the same version as in the [hub Dockerfile](pubhubs_hub/Dockerfile).

  (The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/issue_templates/update-dependencies.md).)

