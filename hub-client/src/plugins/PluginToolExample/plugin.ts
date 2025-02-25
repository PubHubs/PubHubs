/**
 *
 * Example of plugin for registering an item in the menu with it's corresponding page component.
 *
 * Files:
 * - plugin.ts (this file)
 * - PluginToolExample.vue - the component used
 *
 */

import { MenuPluginProperties, PluginType } from '@/logic/store/plugins';

// As this is a menu item, we need a translation for the name in the menu
// In this case we just create them here
// Its best practice to use a seperate name-space for each plugin keys, to minimize the chance for overlapping keys. In this case we use 'plugin-tool'.
const messages = {
	en: {
		'plugin-tool': {
			menu: 'Tool',
			page: {
				title: 'Plugin Menu Example',
				subtitle: 'Example Plugin',
				text: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.',
			},
		},
	},
	nl: {
		'plugin-tool': {
			menu: 'Gereedschap',
			page: {
				title: 'Plugin Menu Voorbeeld',
				subtitle: 'Voorbeeld Plugin',
				text: 'NL: Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.',
			},
		},
	},
};

// The properties of the plugin
const plugin: MenuPluginProperties = {
	enabled: false,
	name: 'tool-example',
	plugintype: PluginType.MENU,
	icon: 'person',
	key: 'plugin-tool.menu',
	to: { name: 'plugin-tool-example', params: {} },
	component: 'PluginToolExample',
	i18n_messages: messages,
};

export { plugin };
