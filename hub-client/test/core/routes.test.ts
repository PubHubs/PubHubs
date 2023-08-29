import { expect, test } from 'vitest';
import { routes } from '@/core/router.ts';

test('routes', () => {
	expect(routes).toBeTypeOf('object');
	expect(Object.keys(routes).length).toBe(8);
});
