/**
 *
 * Example of plugin for registering a specific message component
 *
 * Files:
 * - plugin.ts (this file)
 * - PluginEventMessageTypeExample.vue - the component used
 */

import { TypePluginProperties, PluginType } from '@/store/plugins';

const plugin: TypePluginProperties = {
	enabled: false,
	name: 'event-message-type-example',
	plugintype: PluginType.MESSAGE,

	// The message type that will be rendered by this plugin
	type: 'm.text',

	// It is optional to use this plugin only for specific rooms (id or type)
	// room_id: '',
	// room_type: 'ph.plugin.example',

	// The component that will be responsible for rendering this event
	component: 'PluginEventMessageTypeExample',
};

export { plugin };
