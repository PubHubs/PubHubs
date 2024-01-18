import { Room, Event, useSettings, featureFlagType } from '@/store/store';
import { useMenu, MenuItem } from '@/store/menu';
import { defineStore } from 'pinia';

//
// Plugin Types
//

enum PluginType {
	MENU = 'menu',
	ROOM = 'room',
	EVENT = 'event',
	MESSAGE = 'message',
}

/**
 * Basic properties for plugins
 */
interface BasePluginProperties {
	enabled: boolean; // Enable the plugin (true) or disable it (false)
	name: string; // Name of the plugin (will be used for the uri if menu hook is used)
	plugintype: PluginType;
	options?: any; // To make the plugin compatible with Vue Plugins // for future changes
	_path?: string; // Set while registering plugin, just for reference
	i18n_messages?: any; // Setting plugin specific language keys.
}

/**
 * Specifics properties for menu plugins
 */
interface MenuPluginProperties extends BasePluginProperties {
	key: string; // i18n key for menu name - when type = MENU
	icon?: string; // Which icon to use in menu
	to: any; // router to, should be like { name: 'plugin', params : {plugin:NAME}}
	component: string; // Component to use for the rendering
}

/**
 * Specific properties for room plugins (with roomId)
 */
interface RoomIdPluginProperties extends BasePluginProperties {
	id: string; // roomId to use for this rendering
	icon?: string; // Which icon to use in RoomList (default is none)
	component: string; // Component to use for the rendering
}
type RoomIdPluginPropertiesMap = {
	[key: string]: RoomIdPluginProperties;
};

/**
 * Specific propertes for room, event & message plugins (with type)
 */
interface TypePluginProperties extends BasePluginProperties {
	type: string; // Room, Event or Message type to use for this rendering
	room_id?: string; // event or message plugins only for this room
	room_type?: string; // event or message plugins only for this room type
	icon?: string; // Which icon to use in RoomList (default is none)
	component: string; // Component to use for the rendering
}
type TypePluginPropertiesMap = {
	[key: string]: TypePluginProperties;
};
type TypePluginPropertiesArray = Array<TypePluginProperties>;

interface PluginProperties extends MenuPluginProperties, RoomIdPluginProperties, TypePluginProperties {}

/**
 * The main plugin store
 */

const usePlugins = defineStore('plugins', {
	state: () => {
		return {
			plugins: [] as Array<PluginProperties>,
			pluginsRoomId: {} as RoomIdPluginPropertiesMap,
			pluginsRoomType: {} as TypePluginPropertiesMap,
			pluginsEventType: [] as TypePluginPropertiesArray,
			pluginsMessageType: [] as TypePluginPropertiesArray,
		};
	},

	getters: {
		getPluginItemByName: (state) => {
			return (name: string) => {
				const idx = state.plugins.findIndex((plugin: PluginProperties) => plugin.name == name);
				if (idx >= 0) {
					return state.plugins[idx];
				}
				return null;
			};
		},

		hasRoomPlugin: (state) => {
			return (room: Room): PluginProperties | boolean => {
				if (!room) return false;
				if (state.pluginsRoomId[room.roomId]) {
					return state.pluginsRoomId[room.roomId] as PluginProperties;
				}
				const roomType = room.getType();
				if (roomType && state.pluginsRoomType[roomType]) {
					return state.pluginsRoomType[roomType] as PluginProperties;
				}
				return false;
			};
		},

		hasEventPlugin: (state) => {
			return (event: Event, room_id: string | undefined, room_type: string | undefined): PluginProperties | boolean => {
				if (!event) return false;
				const plugin = state.pluginsEventType.find((plugin) => {
					if (plugin.type !== event.type) return false;
					if (typeof plugin.room_id == 'string') {
						if (plugin.room_id != room_id) return false;
					}
					if (typeof plugin.room_type == 'string') {
						if (plugin.room_type != room_type) return false;
					}
					return true;
				});
				if (plugin) {
					return plugin as PluginProperties;
				}
				return false;
			};
		},

		hasEventMessagePlugin: (state) => {
			return (event: Event, room_id: string | undefined, room_type: string | undefined): PluginProperties | boolean => {
				if (!event) return false;
				const plugin = state.pluginsMessageType.find((plugin) => {
					if (plugin.type !== event.content.msgtype) return false;
					if (typeof plugin.room_id == 'string') {
						if (plugin.room_id != room_id) return false;
					}
					if (typeof plugin.room_type == 'string') {
						if (plugin.room_type != room_type) return false;
					}
					return true;
				});
				if (plugin) {
					return plugin as PluginProperties;
				}
				return false;
			};
		},
	},

	actions: {
		setPlugins(plugins: any, router: any) {
			const settings = useSettings();
			if (settings.isFeatureEnabled(featureFlagType.plugins)) {
				if (plugins) {
					const menu = useMenu();
					// this.plugins = plugins;
					plugins.forEach((plugin: PluginProperties) => {
						if (plugin.enabled) {
							this.plugins.push(plugin);
							switch (plugin.plugintype) {
								case PluginType.ROOM:
									if (typeof plugin.id == 'string') {
										this.pluginsRoomId[plugin.id] = plugin;
									}
									if (typeof plugin.type == 'string') {
										this.pluginsRoomType[plugin.type] = plugin;
									}
									break;

								case PluginType.EVENT:
									if (typeof plugin.type == 'string') {
										this.pluginsEventType.push(plugin);
									}
									break;

								case PluginType.MESSAGE:
									if (typeof plugin.type == 'string') {
										this.pluginsMessageType.push(plugin);
									}
									break;

								case PluginType.MENU:
									{
										const MenuPlugin = plugin as MenuPluginProperties;
										const routeName = 'plugin-' + plugin.name;
										// Add plugin page, if it is a menu
										const item = {
											key: MenuPlugin.key,
											icon: MenuPlugin.icon ? MenuPlugin.icon : 'room',
											to: MenuPlugin.to,
										} as MenuItem;
										const route = {
											path: '/' + routeName,
											name: routeName,
											component: () => import('@/plugins/' + MenuPlugin._path + '/' + MenuPlugin.component),
										};
										menu.addMenuItemWithRoute(item, route, router);
									}
									break;
							}
						}
					});
				}
			}
		},
	},
});

export { MenuPluginProperties, RoomIdPluginProperties, TypePluginProperties, PluginProperties, PluginType, usePlugins };
