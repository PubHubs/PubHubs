<template>
    <div :class="buttonClass" class="block font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-75 text-center">
        <slot></slot>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import { buttonSizes } from '@/assets/sizes';

    const colorClass : { [key:string]:string } = {
        'disabled':     'bg-gray-light text-gray',
        'white':        'bg-white hover:bg-blue text-black shadow-md cursor-pointer',
        'gray-light':   'bg-gray-light hover:bg-blue text-white shadow-md cursor-pointer',
        'blue':         'bg-blue hover:bg-blue-dark text-white dark:hover:bg-white dark:hover:text-blue-dark shadow-md cursor-pointer',
        'green':        'bg-green hover:bg-green-dark text-white shadow-md cursor-pointer',
        'red':          'bg-red hover:bg-red-dark text-white shadow-md cursor-pointer',
    };

    const props = defineProps({
        color: {
            type: String,
            default: 'blue',
        },
        size: {
            type: String,
            default: 'base',
        },
        disabled: {
            type: Boolean,
            default: false
        },
    });

    const buttonClass = computed(() => {
        let c = buttonSizes[props.size] + ' ';
        if (props.disabled) {
            c += colorClass['disabled']
        }
        else {
            c += colorClass[props.color];
        }
        return c;
    })

</script>
