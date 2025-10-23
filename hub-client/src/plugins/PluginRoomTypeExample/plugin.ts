/**
 *
 * Example of plugin for registering a specific room component
 *
 * Files:
 * - plugin.ts (this file)
 * - PluginRoomTypeExample.vue - the component used
 */
// Stores
import { PluginType, TypePluginProperties } from '@hub-client/stores/plugins';

const plugin: TypePluginProperties = {
	enabled: true,
	name: 'room-type-example',
	plugintype: PluginType.ROOM,

	// You can specify a special icon for this room. Default is the normal room icon, so only add this when the plugin needs another icon. See `assets/icon.ts` for possible icons.
	icon: 'person',

	// The room type that will be rendered by this plugin
	type: 'ph.plugin.example',

	// The component that will be responsible for rendering this room
	component: 'PluginRoomTypeExample',
};

export { plugin };
