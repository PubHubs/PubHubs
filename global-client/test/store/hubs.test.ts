import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { Hub, useHubs } from '@/store/hubs';

describe('hubs Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('hubs', () => {
		test('default', () => {
			const hubs = useHubs();
			expect(hubs).toBeTypeOf('object');
		});

		test('addHub', () => {
			const hubs = useHubs();
			expect(Object.keys(hubs.hubs).length).toEqual(0);

			const testHub = new Hub('test', 'www.test.test');
			hubs.addHub(testHub);
			expect(Object.keys(hubs.hubs).length).toEqual(1);
			expect(hubs.hubs['test']).toMatchObject(testHub);
		});

		test('hubsArray', () => {
			const hubs = useHubs();
			expect(hubs.hubsArray).toBeTypeOf('object');
			expect(hubs.hubsArray.length).toBeTypeOf('number');
		});

		test('sortedHubsArray', () => {
			const hubs = useHubs();
			hubs.addHub(new Hub('Btest'));
			hubs.addHub(new Hub('Atest'));
			hubs.addHub(new Hub('Ctest'));
			expect(hubs.sortedHubsArray).toBeTypeOf('object');
			expect(hubs.sortedHubsArray.length).toBeTypeOf('number');
			expect(hubs.sortedHubsArray.length).toEqual(hubs.hubsArray.length);
			expect(hubs.sortedHubsArray).not.toEqual(hubs.hubsArray);
		});

		test('hasHubs', () => {
			const hubs = useHubs();
			expect(hubs.hasHubs).toEqual(false);
			hubs.addHub(new Hub('test'));
			expect(hubs.hasHubs).toEqual(true);
		});

		test('hubExists', () => {
			const hubs = useHubs();
			expect(hubs.hubExists('test')).toEqual(false);
			hubs.addHub(new Hub('test'));
			expect(hubs.hubExists('test')).toEqual(true);
		});

		test('hub', () => {
			const hubs = useHubs();
			hubs.addHub(new Hub('test'));
			expect(hubs.hub('test')).toBeTypeOf('object');
		});
	});
});
