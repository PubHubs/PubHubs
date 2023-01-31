<template>
    <div>
        <div v-if="isFormVisible" class="flex flex-row">
            <TextInput class="grow" v-model="value" :placeholder="placeholder" @keydown="changed()" @keydown.enter="submit();resetVisibility();" @keydown.esc="cancel();resetVisibility();"></TextInput>
            <Icon type="plus" size="lg" class="cursor-pointer m-2" @click="submit()"></Icon>
        </div>
        <Icon v-else type="plus" class="cursor-pointer" @click="showForm()"></Icon>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue';
    import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

    const props = defineProps({
        placeholder: {
            type: String,
            default: 'input',
        },
        visible: {
            type: Boolean,
            default: true,
        },
    });

    const emit = defineEmits(usedEvents);
    const { value, changed, submit, cancel } = useFormInputEvents(emit);

    let isFormVisible = ref(props.visible);

    function showForm() {
        isFormVisible.value = true;
    }

    function resetVisibility() {
        isFormVisible.value = props.visible;
    }

</script>
