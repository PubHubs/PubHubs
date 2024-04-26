/**
 *
 * Example of plugin for registering a specific event component
 *
 * Files:
 * - plugin.ts (this file)
 * - PluginEventTypeExample.vue - the component used
 */

import { TypePluginProperties, PluginType } from '@/store/plugins';

const plugin: TypePluginProperties = {
	enabled: false,
	name: 'event-type-example',
	plugintype: PluginType.EVENT,

	// The event type that will be rendered by this plugin
	type: 'm.room.message',

	// It is optional to use this plugin only for specific rooms (id or type)
	// room_id: '....',
	// room_type: 'ph.plugin.example',

	// The component that will be responsible for rendering this event
	component: 'PluginEventTypeExample',
};

export { plugin };
