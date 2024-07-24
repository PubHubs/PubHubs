# Branding guide for Hubs

## Introduction & Scope

Hubs can have their own branding. But within the scope of keeping the User Experience of PubHubs on every Hub the same and recognisable to all users.

Which means branding can change:

- Logo's
- Colors

But not (for example):

- Headers
- Buttons
- Other clickable items
- Structure of menu's

## Technical insights

The compontens of the hub client are made with [Vue](https://vuejs.org/). The styling is done with [Tailwind](https://tailwindcss.com/).

## Dark & Light theme

The user can select one of tree themes:

- Sytem (will be Light or Dark depending on the settings of the device or browser)
- Light
- Dark

# Local developing branding

See [HubClient developing](./HUBCLIENT_DEVELOPMENT.md) for developing the `hub-client` localy.

# Colors

We have a selection of colors prepared in the file `hub-client/src/assets/tailwind.css` with the use of CSS variables.
These CSS variables can be overwritten with the file `hub-client/src/assets/branding.css`. This probably doesn't exists in the `assets` folder. But it should in `hub-client/branding`, so copy this file.
It is enough to only add the CSS variables of the colors you need to change.

# Logo

Logo's should be in the folder `hub-client/src/assets`. And there are two files needed:

- `logo.svg` for the light theme.
- `logo-dark.svg` for the dark theme.

Size should be between 64x64 or 152x64 pixels. Or bigger with the same aspect-ratio.
Just overwrite these files with your logo's. The original logo's can be found in the folder `hub-client/branding`.

# Move branding to the (running) hub container

When everything is fine locally you need to move the files to the hub-clients docker container:

## Make sure the branding specific files are in `./branding`

- Copy the logo's and the `branding.css` file to the `branding` folder on the container, which should be in the root.
- Within the container run `./rebrand.sh ##CONTAINER_NAME##`. Where ##CONTAINER_NAME## is the name of the container.

## Restore original PubHubs branding

- Within the container run `./rebrand.sh ##CONTAINER_NAME## p`. Where ##CONTAINER_NAME## is the name of the container.

[&larr; Table of Content](../README.md)
