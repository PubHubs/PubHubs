/**
 *
 * Example of plugin for registering a specific room component
 *
 * Files:
 * - plugin.ts (this file)
 * - PluginRoomExample.vue - the component used
 */

import { RoomIdPluginProperties, PluginType } from '@/logic/store/plugins';

const plugin: RoomIdPluginProperties = {
	enabled: true,
	name: 'room-example',
	plugintype: PluginType.ROOM,

	// You can specify a special icon for this room. Default is the normal room icon, so only add this when the plugin needs another icon. See `assets/icon.ts` for possible icons.
	icon: 'cog',

	// The room_id that will be rendered by this plugin
	id: '!WRAIlrtZsRQMlDJApb:main.testhub-matrix.ihub.ru.nl',

	// The component that will be responsible for rendering this room
	component: 'PluginRoomExample',
};

export { plugin };
