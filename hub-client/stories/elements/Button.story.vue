<template>
    <Story title="Elements/Button">
        <Button :color="state.color" :size="state.size" :disabled="state.disabled">Klik op mij!</Button>
        <template #controls>
            <HstButtonGroup v-model="state.color" title="Color" :options="colors" />
            <HstButtonGroup v-model="state.size" title="Size" :options="sizes" />
            <HstCheckbox v-model="state.disabled" title="Disabled" />
        </template>
    </Story>
</template>

<script setup lang="ts">
    import { reactive } from 'vue'
    import Button from '@/components/elements/Button.vue';
    import { buttonSizes } from '@/assets/sizes';

    const colors = ['blue','green','red'];
    const sizes = Object.keys(buttonSizes);

    const state = reactive({
        color:'blue',
        size:'base',
        disabled:false,
    })
</script>
