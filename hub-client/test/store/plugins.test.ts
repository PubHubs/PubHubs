import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { usePlugins, MenuPluginProperties, RoomIdPluginProperties, TypePluginProperties, PluginType } from '@/logic/store/plugins';

class MockedRouter {
	//@ts-nocheck
	public addRoute(route: any) {}
}
const router = new MockedRouter();

const MockedRoom = {
	roomId: '##roomId##',
	getType: function () {
		return 'type';
	},
};

const MockedEvent = {
	type: 'm.room.member',
	content: {
		msgtype: '',
	},
};

const menuPluginTest = {
	enabled: true,
	name: 'menu-example',
	plugintype: PluginType.MENU,
} as MenuPluginProperties;

const disabledPluginTest = {
	enabled: false,
	name: 'disabled-example',
	plugintype: PluginType.MENU,
} as MenuPluginProperties;

const roomPluginTest = {
	enabled: true,
	name: 'room-example',
	plugintype: PluginType.ROOM,
	id: '##roomId##',
} as RoomIdPluginProperties;

const eventPluginTest = {
	enabled: true,
	name: 'event-type-example',
	plugintype: PluginType.EVENT,
	type: 'm.room.member',
} as TypePluginProperties;

const messagePluginTest = {
	enabled: true,
	name: 'event-message-type-example',
	plugintype: PluginType.MESSAGE,
	type: 'm.text',
} as TypePluginProperties;

describe('Plugins Store', () => {
	let plugins = {} as any;
	const pluginSet = [menuPluginTest, disabledPluginTest, roomPluginTest, eventPluginTest, messagePluginTest];

	beforeEach(() => {
		setActivePinia(createPinia());
		plugins = usePlugins();
	});

	describe('set plugins', () => {
		test('default situation', () => {
			expect(plugins.hasPlugins).toBe(false);
		});

		test('empty set', () => {
			plugins.setPlugins();
			expect(plugins.hasPlugins).toBe(false);
		});

		test('one set', () => {
			plugins.setPlugins([menuPluginTest], router);
			expect(plugins.length).toBe(1);
			expect(plugins.hasPlugins).toBe(true);
		});

		test('more set', () => {
			plugins.setPlugins(pluginSet, router);
			// 4 because one of the test plugins is disabled
			expect(plugins.length).toBe(4);
			expect(plugins.hasPlugins).toBe(true);
		});
	});

	describe('plugin getters', () => {
		beforeEach(() => {
			plugins.setPlugins(pluginSet, router);
		});

		test('getPluginItemByName', () => {
			const item = plugins.getPluginItemByName(menuPluginTest.name);
			expect(item).toBeTypeOf('object');
			expect(item).toHaveProperty('enabled');
			expect(item).toHaveProperty('name');
			expect(item).toHaveProperty('plugintype');
			expect(item.plugintype).toBe(PluginType.MENU);
		});

		test('hasRoomPlugin', () => {
			const item = plugins.hasRoomPlugin(MockedRoom);
			expect(item).toBeTypeOf('object');
			expect(item).toHaveProperty('enabled');
			expect(item).toHaveProperty('name');
			expect(item).toHaveProperty('plugintype');
			expect(item.plugintype).toBe(PluginType.ROOM);
		});

		test('getEventPlugin', () => {
			const item = plugins.getEventPlugin(MockedEvent);
			expect(item).toBeTypeOf('object');
			expect(item).toHaveProperty('enabled');
			expect(item).toHaveProperty('name');
			expect(item).toHaveProperty('plugintype');
			expect(item.plugintype).toBe(PluginType.EVENT);
		});
	});
});
