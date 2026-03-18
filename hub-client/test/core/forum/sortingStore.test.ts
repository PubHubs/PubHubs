import { SortOptionKey, sortOptions } from '@hub-client/stores/forum/sortingStore';
import { describe, expect, test } from 'vitest';

describe('sortingStore.vue test', () => {
	test('sort on likes', async () => {
		const list_unsorted: any = [
			{ body: 'a', likes: 5 },
			{ body: 'b', likes: 2 },
			{ body: 'c', likes: 7 },
			{ body: 'd', likes: 4 },
		];
		const list_sorted: any = [
			{ body: 'b', likes: 2 },
			{ body: 'd', likes: 4 },
			{ body: 'a', likes: 5 },
			{ body: 'c', likes: 7 },
		];
		const sortOption = sortOptions.find((option) => option.key === SortOptionKey.LIKES);
		list_unsorted.sort(sortOption?.sortFn);

		expect(list_unsorted).toStrictEqual(list_sorted);
	});

	test('sort on date', async () => {
		const list_unsorted: any = [
			{ body: 'a', timestamp: 5 },
			{ body: 'b', timestamp: 2 },
			{ body: 'c', timestamp: 7 },
			{ body: 'd', timestamp: 4 },
		];
		const list_sorted: any = [
			{ body: 'b', timestamp: 2 },
			{ body: 'd', timestamp: 4 },
			{ body: 'a', timestamp: 5 },
			{ body: 'c', timestamp: 7 },
		];
		const sortOption = sortOptions.find((option) => option.key === SortOptionKey.DATE);
		list_unsorted.sort(sortOption?.sortFn);

		expect(list_unsorted).toStrictEqual(list_sorted);
	});
});
