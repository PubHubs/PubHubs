<template>
    <Story title="Forms/ButtonGroup">
        <ButtonGroup :value="options[0].value" :options="options" :size="state.size"></ButtonGroup>
        <template #controls>
            <HstButtonGroup v-model="state.size" title="Size" :options="sizes" />
        </template>
    </Story>
</template>

<script setup lang="ts">
    import { reactive } from 'vue'
    import { Options } from '@/composables/useFormInputEvents';
    import ButtonGroup from '@/components/forms/ButtonGroup.vue';
    import { buttonSizes } from '@/assets/sizes';

    const options:Options = [
        { label:'Keuze 1', value:'keus_1' },
        { label:'Keuze 2', value:'keus_2' },
        { label:'Keuze 3', value:'keus_3' },
        { label:'Keuze 4', value:'keus_4' },
    ];

    const sizes = Object.keys(buttonSizes);

    const state = reactive({
        size:'base',
    })
</script>
