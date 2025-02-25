import { describe, expect, test, vi } from 'vitest';

import { useUserColor, textColors } from '@/logic/composables/useUserColor';
const { color } = useUserColor();

describe('useUserColor', () => {
	test('userColor', () => {
		const numberOfColors = textColors.length;
		const userIds = ['@000', '@006', '@007', '@008', '@00a', '@3aF'];

		expect(numberOfColors).toEqual(7);

		for (let index = 0; index < userIds.length; index++) {
			const userId = userIds[index];
			expect(color(userId)).toBeTypeOf('number');
			expect(color(userId)).toBeGreaterThanOrEqual(0);
			expect(color(userId)).toBeLessThanOrEqual(numberOfColors);
		}
	});
});
