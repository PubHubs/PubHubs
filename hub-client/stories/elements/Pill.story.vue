<template>
    <Story title="Elements/Pill">
        <div class="flex flex-col gap-y-4 md:gap-y-0 md:flex-row justify-between md:gap-x-8 mb-4">
            <Pill>
                <template #header>Lorem ipsum dolor sit amet</template>
                <template #content>Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</template>
            </Pill>
            <Pill>
                <template #header>Lorem ipsum dolor sit amet</template>
                <template #content>Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</template>
            </Pill>
            <Pill>
                <template #header>Lorem ipsum dolor sit amet</template>
                <template #content>Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</template>
            </Pill>
        </div>
    </Story>
</template>

<script setup lang="ts">
    import Pill from '@/components/elements/Pill.vue';
</script>
