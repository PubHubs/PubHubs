import { beforeEach, describe, expect, test } from 'vitest';
// Packages
import { createPinia, setActivePinia } from 'pinia';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

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

		test('plain text', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('Lorem ipsum dolor sit amet,');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor sit amet,');
			expect(content).toHaveProperty('msgtype', 'm.text');
		});

		test('safe html', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor sit amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor sit amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor sit amet');
		});

		test('safe link', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <a href="https://test.nl">sit</a> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor sit amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor <a href="https://test.nl" rel="noopener">sit</a> amet');
		});

		test('no img', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <img src="https://test.nl"> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor  amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor  amet');
		});

		test('matrix img', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <img src="mxc://test.nl"> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor  amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor <img src="mxc://test.nl" /> amet');
		});

		test('no iframes', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <iframe src="mxc://test.nl"> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor  amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor  amet');
		});

		test('no scripts', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <script src="mxc://test.nl">windows.location="bad"</script> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor windows.location="bad" amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor  amet');
		});

		test('only whithin <html></html>', async () => {
			const pubhubs = usePubhubsStore();
			const content = await pubhubs._constructMessageContent('<head><title>Lorem</title></head><html><body><h1>Lorum ipsum dolor amet</h1><p>etc</p></body></html>');

			expect(content).toHaveProperty('body', 'Lorum ipsum dolor ametetc');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<h1>Lorum ipsum dolor amet</h1><p>etc</p>');
		});
	});
});
