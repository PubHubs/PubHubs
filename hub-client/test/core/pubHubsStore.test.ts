import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { usePubHubs } from '@/core/pubhubsStore.ts';

describe('PubHubs Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('_constructMessageContent', () => {
		test('plain text', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('Lorem ipsum dolor sit amet,');
			expect(content).toEqual({
				body: 'Lorem ipsum dolor sit amet,',
				msgtype: 'm.text',
			});
		});

		test('safe html', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor sit amet');
			expect(content).toEqual({
				body: 'Lorem ipsum dolor sit amet',
				format: 'org.matrix.custom.html',
				formatted_body: '<b>Lorem</b> ipsum dolor sit amet',
				msgtype: 'm.text',
			});
		});

		test('safe link', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <a href="https://test.nl">sit</a> amet');
			expect(content).toEqual({
				body: 'Lorem ipsum dolor sit amet',
				format: 'org.matrix.custom.html',
				formatted_body: '<b>Lorem</b> ipsum dolor <a href="https://test.nl" rel="noopener">sit</a> amet',
				msgtype: 'm.text',
			});
		});

		test('no img', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <img src="https://test.nl"> amet');
			expect(content).toEqual({
				body: 'Lorem ipsum dolor  amet',
				format: 'org.matrix.custom.html',
				formatted_body: '<b>Lorem</b> ipsum dolor  amet',
				msgtype: 'm.text',
			});
		});

		test('matrix img', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <img src="mxc://test.nl"> amet');
			expect(content).toEqual({
				body: 'Lorem ipsum dolor  amet',
				format: 'org.matrix.custom.html',
				formatted_body: '<b>Lorem</b> ipsum dolor <img src="mxc://test.nl" /> amet',
				msgtype: 'm.text',
			});
		});

		test('no iframes', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <iframe src="mxc://test.nl"> amet');
			expect(content).toEqual({
				body: 'Lorem ipsum dolor  amet',
				format: 'org.matrix.custom.html',
				formatted_body: '<b>Lorem</b> ipsum dolor  amet',
				msgtype: 'm.text',
			});
		});

		test('no scripts', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('<b>Lorem</b> ipsum dolor <script src="mxc://test.nl">windows.location="bad"</script> amet');
			expect(content).toEqual({
				body: 'Lorem ipsum dolor windows.location="bad" amet',
				format: 'org.matrix.custom.html',
				formatted_body: '<b>Lorem</b> ipsum dolor  amet',
				msgtype: 'm.text',
			});
		});

		test('only whithin <html></html>', () => {
			const pubhubs = usePubHubs();
			const content = pubhubs._constructMessageContent('<head><title>Lorem</title></head><html><body><h1>Lorum ipsum dolor amet</h1><p>etc</p></body></html>');
			expect(content).toEqual({
				body: 'Lorum ipsum dolor ametetc',
				format: 'org.matrix.custom.html',
				formatted_body: '<h1>Lorum ipsum dolor amet</h1><p>etc</p>',
				msgtype: 'm.text',
			});
		});
	});
});
