<template>
    <div :class="buttonClass" class="block py-2 px-4 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-75">
        <slot></slot>
    </div>
</template>

<script lang="ts">
    import { buttonSizes } from '@/assets/sizes';

    const colorClass : { [key:string]:string } = {
        'disabled':     'bg-gray-light text-gray',
        'white':        'bg-white hover:bg-blue text-black shadow-md cursor-pointer',
        'gray-light':   'bg-gray-light hover:bg-blue text-white shadow-md cursor-pointer',
        'blue':         'bg-blue hover:bg-blue-dark text-white dark:hover:bg-white dark:hover:text-blue-dark shadow-md cursor-pointer',
        'green':        'bg-green hover:bg-green-dark text-white shadow-md cursor-pointer',
        'red':          'bg-red hover:bg-red-dark text-white shadow-md cursor-pointer',
    };
</script>

<script setup lang="ts">
    import { computed } from 'vue';

    const props = defineProps({
        color: {
            type: String,
            default: 'blue',
            validator(value:string) {
                return Object.keys(colorClass).includes(value);
            }
        },
        size: {
            type: String,
            default: 'base',
            validator(value:string) {
                return Object.keys(buttonSizes).includes(value);
            }
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
