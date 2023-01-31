<template>
    <ul v-for="option in options" :key="option.value">
        <li>
            <input type="radio" v-model="inputValue" :value="option.value" class="focus:outline-0 focus:outline-offset-0 focus:ring-0 focus:ring-offset-0 focus:ring-offset-width-0 focus:shadow-0" @change="selectOption(option);changed()" />
            <label class="ml-2 dark:text-white" :for="option.value">{{ option.label }}</label>
        </li>
    </ul>
</template>

<script setup lang="ts">
    import { PropType } from 'vue';
    import { Options, useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

    const props = defineProps({
        options: {
            type: Array as PropType<Options>,
            required:true,
        },
        value : {
            type: String,
            default : '',
        },
    });

    const emit = defineEmits(usedEvents);
    const { value : inputValue, setValue, setOptions, selectOption, changed } = useFormInputEvents(emit);

    setValue(props.value);
    setOptions(props.options);

</script>

<style scoped>
    [type="radio"]:checked {
        background-image: none;
    }
    [type="radio"]:focus {
        --tw-ring-offset-width: 0px;
    }

</style>
