<template>
    <select v-model="inputValue" v-tw-class="'w-full'" class="rounded-lg dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0" @change="changed()" @keydown.enter="submit()" @keydown.esc="cancel()">
        <option v-for="option in options" :key="option.value" :value="option.value" :selected="optionIsSelected(option.value)" @click="selectOption(option)">{{option.label}}</option>
    </select>
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
    const { value: inputValue, setValue, setOptions, selectOption, optionIsSelected, changed, submit, cancel } = useFormInputEvents(emit);

    setValue(props.value);
    setOptions(props.options);

</script>
