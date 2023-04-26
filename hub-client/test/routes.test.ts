import { expect, test } from 'vitest'
import {routes} from '@/core/routes.js'

test('routes', () => {
    expect(routes).toBeTypeOf('object');
    expect(Object.keys(routes).length).toBe(5);
})
