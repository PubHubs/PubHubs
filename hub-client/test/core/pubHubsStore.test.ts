// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

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
