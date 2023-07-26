import { assert, expect, test } from 'vitest';

test('JSON', () => {
	const input = {
		foo: 'Hello',
		bar: 'PubHubs',
	};

	const output = JSON.stringify(input);

	expect(output).eq('{"foo":"Hello","bar":"PubHubs"}');
	assert.deepEqual(JSON.parse(output), input, 'matches original');
});
