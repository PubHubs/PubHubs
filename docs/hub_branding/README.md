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

See `README.md` for developing the `hub-client` localy.

## Testing branding with stories

The first step in testing the branding of the hub is done with stories of [Histoire](https://histoire.dev/). Here you can see how the colors interact, how the logo looks in the dark and light theme and how components look like with your colors.

Starting the histoire environment can be done from the `hub-client` folder with the following command:

```
npm run story:dev
```

Open `http://localhost:6006/` in your browser and click away.

# Colors

We have a selection of colors prepared in the file `hub-client/src/assets/tailwind.css` with the use of CSS variables.
These CSS variables can be overwritten with the file `hub-client/src/assets/branding.css`. This probably doesn't exists in the `assets` folder. But it should in `hub-client/branding`, so copy this file.
It is enought to only add the CSS variables of the colors you need to change.

## How the color system works

The color object can have one color, or an object with several variants. These are the variants we use:

- lighter
- light
- DEFAULT (= the default when you don't add a suffix to the color class)
- dark
- darker

NB. There is a gray-middle variant, which is only used for a system gray variant - don't use or add a middle variant to other colors.

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