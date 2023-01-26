import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Badge from '@/components/elements/Badge.vue'

test('mount component', async () => {
    expect(Badge).toBeTruthy()
    const wrapper = mount(Badge,{
        slots: {
            default: '99',
        }
    })

    expect( wrapper.text() ).toBe('99');
})
