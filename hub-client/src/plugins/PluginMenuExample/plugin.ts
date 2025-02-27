/**
 *
 * Example of plugin for registering an item in the menu with it's corresponding page component.
 *
 * Files:
 * - plugin.ts (this file)
 * - PluginMenuExample.vue - the component used
 * - locales/... - the i18n files for translations
 *
 */

// Import plugin types
import { MenuPluginProperties, PluginType } from '@/logic/store/plugins';

// As this is a menu item, we need a translation for the name in the menu
// In this case we import the translations
// Its best practice to use a seperate name-space for each plugin keys, to minimize the chance for overlapping keys. In this case we use 'plugin-example'.
import { nl } from './locales/nl';
import { en } from './locales/en';

// The properties of the plugin
//
const plugin: MenuPluginProperties = {
	// Name, just for reference
	enabled: false,
	name: 'menu-example',

	// The type of the plugin, in this case 'menu'
	plugintype: PluginType.MENU,

	// An icon that will be shown before the menu item. Default is the normal icon, so only add this when the plugin needs another icon. See `assets/icon.ts` for possible icons.
	icon: 'cog',

	// key name for the name in the menu. This key is used by the tranlations. You can use default ones from the client (see in `locales`), but here we use a plugin specific key.
	key: 'plugin-example.menu',

	// Route for the menu, this ('name') will be reflected in the uri
	to: { name: 'plugin-menu-example', params: {} },

	// The name of the component used, this is part of the plugin and should be in the same folder as this file.
	component: 'PluginMenuExample',

	// The translated messages, these will be merged with the i18n messages from the hub client.
	i18n_messages: {
		nl: nl,
		en: en,
	},
};

export { plugin };
