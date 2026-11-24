// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Stores
import { SystemDefaults } from '@hub-client/models/constants';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

describe('PubHubs Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('_constructMessageContent', () => {
		test('public rooms listing', async () => {
			//Pretend to be the client.
			function mockClient(more) {
				return {
					publicRooms: (optional) => {
						const batch = 'batch';
						if (optional && optional.since && optional.since === batch) {
							return { chunk: ['2'] };
						}
						if (more) {
							return { chunk: ['1'], next_batch: batch };
						} else {
							return { chunk: ['1'] };
						}
					},
				};
			}

			const pubhubs = usePubhubsStore() as Partial<any>;
			pubhubs.client = mockClient(true);
			let x = await pubhubs.getAllPublicRooms();
			expect(x).toEqual(['1', '2']);
			//We cache the public rooms
			pubhubs.client = mockClient(false);
			x = await pubhubs.getAllPublicRooms();
			expect(x).toEqual(['1', '2']);
		});

		test('public rooms pagination stops when the server repeats next_batch', async () => {
			let calls = 0;
			const pubhubs = usePubhubsStore() as Partial<any>;
			pubhubs.client = {
				publicRooms: () => {
					calls++;
					return Promise.resolve({ chunk: [String(calls)], next_batch: 'same' });
				},
			};
			expect(await pubhubs.getAllPublicRooms()).toEqual(['1', '2']);
			expect(calls).toBe(2);
		});

		test('public rooms pagination stops on an empty page', async () => {
			let calls = 0;
			const pubhubs = usePubhubsStore() as Partial<any>;
			pubhubs.client = {
				publicRooms: () => {
					calls++;
					return Promise.resolve({ chunk: calls === 1 ? ['1'] : [], next_batch: `batch${calls}` });
				},
			};
			expect(await pubhubs.getAllPublicRooms()).toEqual(['1']);
			expect(calls).toBe(2);
		});

		test('public rooms pagination stops at the page limit', async () => {
			let calls = 0;
			const pubhubs = usePubhubsStore() as Partial<any>;
			pubhubs.client = {
				publicRooms: () => {
					calls++;
					return Promise.resolve({ chunk: [String(calls)], next_batch: `batch${calls}` });
				},
			};
			const result = await pubhubs.getAllPublicRooms();
			expect(calls).toBe(SystemDefaults.maxPublicRoomsPages);
			expect(result.length).toBe(SystemDefaults.maxPublicRoomsPages);
		});

		test('concurrent public rooms listing shares one request', async () => {
			let calls = 0;
			let respond: (value: { chunk: string[] }) => void = () => {};
			const pubhubs = usePubhubsStore() as Partial<any>;
			pubhubs.client = {
				publicRooms: () => {
					calls++;
					return new Promise((resolve) => (respond = resolve));
				},
			};

			// A second caller while the first request is in flight must not get the still-empty cache.
			const first = pubhubs.getAllPublicRooms();
			const second = pubhubs.getAllPublicRooms();
			respond({ chunk: ['1'] });
			expect(await first).toEqual(['1']);
			expect(await second).toEqual(['1']);
			expect(calls).toBe(1);
		});

		test('failed public rooms listing is retried on the next call', async () => {
			const pubhubs = usePubhubsStore() as Partial<any>;
			pubhubs.client = {
				publicRooms: () => Promise.reject(new Error('network')),
			};
			await expect(pubhubs.getAllPublicRooms()).rejects.toThrow('network');

			pubhubs.client = { publicRooms: () => Promise.resolve({ chunk: ['1'] }) };
			expect(await pubhubs.getAllPublicRooms()).toEqual(['1']);
		});

		test('getPublicRoomsSafe falls back to the cached list on failure', async () => {
			const pubhubs = usePubhubsStore() as Partial<any>;
			pubhubs.client = { publicRooms: () => Promise.resolve({ chunk: ['1'] }) };
			await pubhubs.getAllPublicRooms();

			pubhubs.client = { publicRooms: () => Promise.reject(new Error('network')) };
			expect(await pubhubs.getPublicRoomsSafe(true)).toEqual(['1']);
		});

		test('fetchPublicRooms does not reject and keeps the current list on failure', async () => {
			const pubhubs = usePubhubsStore() as Partial<any>;
			const rooms = useRooms();
			pubhubs.client = { publicRooms: () => Promise.resolve({ chunk: [{ room_id: '!a', name: 'A' }] }) };
			expect(await rooms.fetchPublicRooms()).toBe(true);

			pubhubs.client = { publicRooms: () => Promise.reject(new Error('network')) };
			expect(await rooms.fetchPublicRooms(true)).toBe(false);
			expect(rooms.publicRooms).toEqual([{ room_id: '!a', name: 'A' }]);
		});

		test('joinRoom succeeds when public rooms cannot be fetched', async () => {
			const pubhubs = usePubhubsStore() as Partial<any>;
			const rooms = useRooms();
			const matrixRoom = { roomId: '!a', name: 'A' };
			pubhubs.client = {
				publicRooms: () => Promise.reject(new Error('network')),
				joinRoom: () => Promise.resolve(matrixRoom),
				store: { storeRoom: vi.fn() },
			};
			const initRoom = vi.spyOn(rooms, 'initRoomsWithMatrixRoom').mockImplementation(() => {});
			vi.spyOn(rooms, 'updateRoomList').mockImplementation(() => {});

			expect(await pubhubs.joinRoom('!a', 'some.type')).toBe(0);
			expect(initRoom).toHaveBeenCalledWith(matrixRoom, 'A', 'some.type', []);
		});

		test('plain text', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('Lorem ipsum dolor sit amet,');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor sit amet,');
			expect(content).toHaveProperty('msgtype', 'm.text');
		});

		// The message input is a plain text field: markup typed by the user is not interpreted, it is
		// kept verbatim in the body. Escaping happens at render time, so nothing is sent as HTML here.
		test('markup is kept verbatim, not sent as html', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor sit amet');

			expect(content).toHaveProperty('body', '<b>Lorem</b> ipsum dolor sit amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).not.toHaveProperty('format');
			expect(content).not.toHaveProperty('formatted_body');
		});

		test('script tags are not sent as html', async () => {
			const pubhubs = usePubhubsStore();
			const source = 'Lorem ipsum dolor <script src="mxc://test.nl">windows.location="bad"</script> amet';
			const content = await pubhubs._constructMessageContent(source);

			expect(content).toHaveProperty('body', source);
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).not.toHaveProperty('format');
			expect(content).not.toHaveProperty('formatted_body');
		});

		// Regression: `<H|` starts a tag as far as an HTML parser is concerned (`|` is a legal tag name
		// character), and the tag is only closed by the next `>` — five lines down, in `>= obs1`.
		// Treating this paste as HTML deleted everything in between.
		test('pasted code containing < is not truncated', async () => {
			const pubhubs = usePubhubsStore();
			const source = [
				'obs1 = Predicate("100<H| + -50<T|")',
				'obs2 = Predicate("100<H| + 50<T|")',
				'# parsing error in:',
				'#obs3 = Predicate("100<H| - 50<T|")',
				'# same outcomes:',
				'print( flip(Fraction(3,10)) >= obs1 )',
				'print( flip(Fraction(3,10)) >= obs2 )',
			].join('\n');
			const content = await pubhubs._constructMessageContent(source);

			expect(content).toHaveProperty('body', source);
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).not.toHaveProperty('format');
			expect(content).not.toHaveProperty('formatted_body');
		});

		test('generics and comparisons are not truncated', async () => {
			const pubhubs = usePubhubsStore();
			const source = 'let x: Vec<T> = a<b && b>c;';
			const content = await pubhubs._constructMessageContent(source);

			expect(content).toHaveProperty('body', source);
			expect(content).not.toHaveProperty('formatted_body');
		});
	});
});
