// Packages
import { defineStore } from 'pinia';

// Types
type MenuItem = {
	key: string; // i18n key for name
	icon?: string;
	to: any; // router-to object
	path?: string;
};

type MenuItems = Array<MenuItem>;

const defaultMenu: MenuItems = [
	{ key: 'menu.home', icon: 'house', to: { name: 'home' }, path: '/' },
	{ key: 'menu.directmsg', icon: 'chat-circle-text', to: { name: 'direct-msg' }, path: '/direct-msg' },
	{ key: 'menu.discover', icon: 'compass', to: { name: 'discover-rooms' }, path: '/discover-rooms' },
];

const useMenu = defineStore('menu', {
	state: () => {
		return {
			menu: defaultMenu,
			activeMenuItemId: '' as string,
		};
	},

	getters: {
		getMenu: (state): MenuItems => {
			const menu = state.menu;
			return menu;
		},
	},

	actions: {
		addMenuItem(item: MenuItem) {
			this.menu.push(item);
		},

		addMenuItemWithRoute(item: MenuItem, route: any, router: any) {
			router.addRoute(route);
			this.addMenuItem(item);
		},

		setActiveMenuItem(id: string) {
			this.activeMenuItemId = id;
		},

		getMenuItemPath(routeName: string) {
			return this.$state.menu
				.filter((menuItem) => menuItem.to['name'] === routeName)
				.map((filteredMenuItem) => filteredMenuItem.path)
				.pop();
		},
	},
});

export { useMenu, MenuItem, MenuItems };
