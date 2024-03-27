# Updating dependencies
## PubHubs central
### Rust
 - [ ] In the `pubhubs` directory, run `cargo update` to install updates that are likely backwards compatible. 
 - [ ] To check for new major releases (that might break the current code), run [`cargo outdated`](https://github.com/kbknapp/cargo-outdated) (which must be installed first.) 
   Adjust `Cargo.toml` accordingly and check if `cargo test` succeeds.  If you encounter errors, try if you can easily fix them; if not, revert and make an issue.
     - **NOTE:** you may ignore the `cargo outdated` for now;  there are several packages `hyper`, `expry`, `hairy`, used by the old rust code that have major new versions that require quite a rewrite of the old code that is both dangerous and wasteful with the new code coming in. 

## Hub
 - [ ] Check the version numbers in the [hub Dockerfile](pubhubs_hub/Dockerfile):
   - [ ] `git clone https://github.com/privacybydesign/irmago --branch vXXXX` see [yivi releases](https://github.com/privacybydesign/irmago/releases)
   - [ ] `FROM ghcr.io/element-hq/synapse:vXXXX` see [synapse releases](https://github.com/element-hq/synapse/releases)
   - [ ] `FROM golang:<debian_version>` The [debian_version](https://www.debian.org/releases/stable/) should be the same for both golang and rust and the same as the version on which the synapse image is based. This is to prevent errors like to avoid errors like "OSError: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.33' not found (required by /usr/lib/libpubhubs.so)".
   - [ ] `FROM rust:<debian_version> AS libpubhubs_build`

## Global Client

For reference, dependencies are in `package.json`.

- [ ] In the `global-client` directory, run `npm update` to install minor version updates (probably non-breaking changes).
- [ ] Run `npm outdated` to check for major updates (difference between wantend and latest) and change the package.json file to update major versions if wanted (preferably in a seperate commit). **Don't update major versions for now, see #498**
- [ ] To address issues that do not require attention, run: `npm audit fix`
- [ ] To address issues with breaking changes, check them and solve them if possible.

## Hub Client

For reference, dependencies are in `package.json`.

- [ ] In the `hub-client` directory, run `npm update` to install minor version updates (probably non-breaking changes).
- [ ] Run `npm outdated` to check for major updates (difference between wantend and latest) and change the package.json file to update major versions if wanted (preferably in a seperate commit). **Don't update major versions for now, see #498**
- [ ] To address issues that do not require attention, run: `npm audit fix`
- [ ] To address issues with breaking changes, check them and solve them if possible.

## Yivi docker
 - [ ] Check the version numbers in the [yivi Dockerfile](docker_yivi/Dockerfile)
   - [ ] `FROM golang:XXX`
   - [ ] `git clone https://github.com/privacybydesign/irmago --branch vXXXX` Please check that you've selected the same version as in the [hub Dockerfile](pubhubs_hub/Dockerfile).

  (The `merge-to-stable` merge request template can be edited [here](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/edit/main/.gitlab/merge_request_templates/update-dependencies.md).)
