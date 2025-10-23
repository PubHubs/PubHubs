# Plugins guide for Hubs

## Introduction & Scope

Hubs can have their own plugins for there hub-client.

Plugins can hook into several parts of the hub-client:

- Menu - Which will add an item to the top menu and opens a specific page component for that plugin.
- Room - A room can have its complete own rendering component. This can be for a specific room (id) or room type.
- Event - An event can have its own rendering component. This can be set for a specific event type and can be active for all or specific room(s) (id or type).
- Message - A event message can have its own rendering component. This can be set for a specific message type and can be active for all or specific room(s) (id or type).

## Developing a plugin

A plugin is in it's core a folder, which name starts with `Plugin`. In the folder there should be at least one configuration file called `plugin.ts`.
In most cases there are also one or more vue component files as well as seperate language files (for example, when a plugin hooks into the menu).

So a plugin folder could look like this:

- PluginName
    - plugin.ts
    - PluginComponent.vue
    - locales
      - en.ts
      - nl.ts

### Configuration file `plugin.ts`

In `plugin.ts` you need to export a `plugin` object with several properties. Which properties depends on the type of plugin. A simple plugin that hooks into the menu could look like this:

```
// Import of types
import { MenuPluginProperties, PluginType } from '@/stores/plugins';

const plugin: MenuPluginProperties = {

    // Enable the plugin (true) or disable (false)
    enabled : true,

    // name is just for reference, but should be unique.
    name: 'menu-example',

    // type of plugin
    plugintype: PluginType.MENU,

    // language key for the name in the menu
    key: 'menu.tool',

    // route for the page, the name part will be the uri
    to: { name: 'plugin-example', params: {} },

    // component wich will render the page. This will be a file (PluginExample.vue) in the same folder.
    component: 'PluginExample',
};

export { plugin };
```

### Example plugins

In the folder `hub-client/plugins` you will find several example plugins for every hook. These are documented and can be used as a starter template and should be enough to get you going.

## Local developing

It is best practice to develop and test a plugin locally.
See [HubClient developing](./HUBCLIENT_DEVELOPMENT.md) for developing the `hub-client` localy.

If you are developing locally, your plugin(s) should be present in the folder `src/plugins`.

## Install plugins to the (running) hub container

Because the plugins will be an integral part of the build of the client. You need to (re)build the client. And make sure the new build is moved to the running docker container.

For convenience, we have an example script for installing and uninstalling plugins for a local running system:

### Make sure the plugin files are in `./plugins`

- Copy the plugins to the `plugins` folder on the container, which should be in the root.
- Within the container run `./install_plugins.sh ##CONTAINER_NAME##`. Where ##CONTAINER_NAME## is the name of the container. This will move the plugins to the right folder, rebuild the client and restart the container.

### Uninstall plugins

- Within the container run `./install_plugins.sh ##CONTAINER_NAME## u`. Where ##CONTAINER_NAME## is the name of the container. This will rebuild the client and restart the container.
