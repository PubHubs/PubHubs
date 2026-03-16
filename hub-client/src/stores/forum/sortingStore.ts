import { defineStore } from 'pinia';

export enum SortDirection {
	ASC = 'asc',
	DESC = 'desc',
}

export enum SortOptionKey {
	LIKES,
	DATE,
}

export type SortOption = {
	key: SortOptionKey;
	label?: string;
	icon?: string;
	sortFn: (a: any, b: any) => number;
};

export const sortOptions: SortOption[] = [
	{
		key: SortOptionKey.LIKES,
		label: 'Likes',
		icon: 'like_heart',
		sortFn: (a, b) => a.likes - b.likes,
	},
	{
		key: SortOptionKey.DATE,
		label: 'Date',
		icon: 'calendar',
		sortFn: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	},
];

export const useSortingStore = defineStore('sortingStore', {
	state: () => ({
		key: SortOptionKey.LIKES,
		direction: SortDirection.DESC,
		isMenuOpen: false,
	}),

	getters: {
		getDirectionIcon() {
			return (key: SortOptionKey) => {
				if (this.key !== key) {
					return 'chevron_up_down';
				} else if (this.direction === SortDirection.ASC) {
					return 'chevron_up';
				}
				return 'chevron_down';
			};
		},
	},

	actions: {
		toggleOption(key: SortOptionKey) {
			if (this.key !== key) {
				this.key = key;
				this.direction = SortDirection.DESC;
			} else if (this.direction === SortDirection.DESC) {
				this.direction = SortDirection.ASC;
			} else {
				this.direction = SortDirection.DESC;
			}
		},
		openMenu() {
			this.isMenuOpen = true;
		},
		closeMenu() {
			this.isMenuOpen = false;
		},
	},
});
