import { expect, test } from 'vitest'
import filters from "@/core/filters";

test('matrixDisplayName', () => {

    let userName = '@display:matrix'
    let displayName = filters.matrixDisplayName(userName)
    expect(displayName).toBe('display');

    userName = '@display.test:matrix.test'
    displayName = filters.matrixDisplayName(userName)
    expect(displayName).toBe('display.test');

})

test('localeDateFromTimestamp', () => {
    const timestamp = Date.now();
    expect(filters.localeDateFromTimestamp(timestamp)).toBeTypeOf('string');
})
