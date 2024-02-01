import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { usePubHubs } from '@/core/pubhubsStore.ts';

describe('PubHubs Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('_constructMessageContent', () => {
		test('plain text', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('Lorem ipsum dolor sit amet,');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor sit amet,');
			expect(content).toHaveProperty('msgtype', 'm.text');
		});

		test('safe html', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor sit amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor sit amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor sit amet');
		});

		test('safe link', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <a href="https://test.nl">sit</a> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor sit amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor <a href="https://test.nl" rel="noopener">sit</a> amet');
		});

		test('no img', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <img src="https://test.nl"> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor  amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor  amet');
		});

		test('matrix img', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <img src="mxc://test.nl"> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor  amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor <img src="mxc://test.nl" /> amet');
		});

		test('no iframes', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <iframe src="mxc://test.nl"> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor  amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor  amet');
		});

		test('no scripts', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <script src="mxc://test.nl">windows.location="bad"</script> amet');

			expect(content).toHaveProperty('body', 'Lorem ipsum dolor windows.location="bad" amet');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<b>Lorem</b> ipsum dolor  amet');
		});

		test('only whithin <html></html>', async () => {
			const pubhubs = usePubHubs();
			const content = await pubhubs._constructMessageContent('<head><title>Lorem</title></head><html><body><h1>Lorum ipsum dolor amet</h1><p>etc</p></body></html>');

			expect(content).toHaveProperty('body', 'Lorum ipsum dolor ametetc');
			expect(content).toHaveProperty('msgtype', 'm.text');
			expect(content).toHaveProperty('format', 'org.matrix.custom.html');
			expect(content).toHaveProperty('formatted_body', '<h1>Lorum ipsum dolor amet</h1><p>etc</p>');
		});
	});
});
