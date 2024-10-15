import { defineStore } from 'pinia';

type MenuItem = {
	key: string; // i18n key for name
	icon?: string;
	to: any; // router-to object
};

type MenuItems = Array<MenuItem>;

const defaultMenu: MenuItems = [{ key: 'menu.home', icon: 'home', to: { name: 'home' } }];

const useMenu = defineStore('menu', {
	state: () => {
		return {
			menu: defaultMenu as MenuItems,
			activeMenuItemId: '' as String,
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

		setActiveMenuItem(id: String) {
			this.activeMenuItemId = id;
		},
	},
});

export { useMenu, MenuItem, MenuItems };
