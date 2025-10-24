<template>
	<div>
		<div v-if="isFormVisible" class="flex flex-row">
			<TextInput
				class="grow"
				v-model="value"
				:placeholder="placeholder"
				@keydown="changed()"
				@keydown.enter="
					submit();
					resetVisibility();
				"
				@keydown.esc="
					cancel();
					resetVisibility();
				"
			/>
			<Icon type="plus" size="lg" class="m-2 cursor-pointer" @click="submit()" />
		</div>
		<Icon v-else type="plus" class="cursor-pointer" @click="showForm()" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TextInput from '@hub-client/components/forms/TextInput.vue';

	// Composables
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

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
