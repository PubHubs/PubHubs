import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { useHubs } from '../../src/logic/store/hubs';
import { Hub } from '../../src/model/Hubs';

let pinia;

describe('hubs Store', () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	describe('hubs', () => {
		test('default', () => {
			const hubs = useHubs(pinia);
			expect(hubs).toBeTypeOf('object');
		});

		test('addHub', () => {
			const hubs = useHubs(pinia);
			expect(Object.keys(hubs.hubs).length).toEqual(0);

			const testHub = new Hub('test-Id', 'test', 'www.test.test', 'serverurl', 'description', pinia);
			hubs.addHub(testHub);
			expect(Object.keys(hubs.hubs).length).toEqual(1);
			expect(hubs.hubs['test-Id']).toMatchObject(testHub);
		});

		test('hubsArray', () => {
			const hubs = useHubs(pinia);
			expect(hubs.hubsArray).toBeTypeOf('object');
			expect(hubs.hubsArray.length).toBeTypeOf('number');
		});

		test('sortedHubsArray', () => {
			const hubs = useHubs(pinia);
			hubs.addHub(new Hub('Btest-Id', 'Btest', 'url', 'serverurl', 'description', pinia));
			hubs.addHub(new Hub('Atest-Id', 'Atest', 'url', 'serverurl', 'description', pinia));
			hubs.addHub(new Hub('Ctest-Id', 'Ctest', 'url', 'serverurl', 'description', pinia));
			expect(hubs.sortedHubsArray).toBeTypeOf('object');
			expect(hubs.sortedHubsArray.length).toBeTypeOf('number');
			expect(hubs.sortedHubsArray.length).toEqual(hubs.hubsArray.length);
			expect(hubs.sortedHubsArray).not.toEqual(hubs.hubsArray);
		});

		test('hasHubs', () => {
			const hubs = useHubs(pinia);
			expect(hubs.hasHubs).toEqual(false);
			hubs.addHub(new Hub('test-Id', 'test', 'url', 'serverurl', 'description', pinia));
			expect(hubs.hasHubs).toEqual(true);
		});

		test('hubExists', () => {
			const hubs = useHubs(pinia);
			expect(hubs.hubExists('test')).toEqual(false);
			hubs.addHub(new Hub('test-Id', 'test', 'url', 'serverurl', 'description', pinia));
			expect(hubs.hubExists('test-Id')).toEqual(true);
		});

		test('hub', () => {
			const hubs = useHubs(pinia);
			hubs.addHub(new Hub('test-Id', 'test', 'url', 'serverurl', 'description', pinia));
			expect(hubs.hub('test-Id')).toBeTypeOf('object');
		});
	});
});
