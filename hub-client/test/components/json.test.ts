import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Json from '@/components/elements/Json.vue'

test('mount component', async () => {
    expect(Json).toBeTruthy()

    const wrapper = mount(Json, {
        props: {
            json: { test: 'test' },
        },
    })

    expect(wrapper.text()).toContain('{\n  "test": "test"\n}')
})
