<template>
	<div v-tw-class="'flex rounded-md border border-black dark:border-white bg-surface-high'">
		<slot name="header"></slot>
		<TextArea
			class="placeholder:text-on-surface-variant w-full flex-grow border-none bg-transparent text-2xl"
			:class="isInline ? 'overflow-y-hidden break-words' : ''"
			v-focus
			:modelValue="modelValue"
			:placeholder="placeholder"
			:max-length="maxLength"
			:disabled="disabled"
			@update:modelValue="emit('update:modelValue', $event)"
			@changed="emit('changed', $event)"
			@submit="emit('submit', $event)"
			@cancel="emit('cancel')"
			@caretPos="emit('caretPos', $event)"
		/>
		<div class="flex items-center justify-between p-2 pt-0 pb-1">
			<div class="flex w-full items-center gap-x-2">
				<slot name="footer-left"></slot>
			</div>
			<div class="flex items-center gap-x-2">
				<slot name="footer-right-l"></slot>
				<div v-if="maxLength" class="text-2xl">{{ modelValue?.length || 0 }}/{{ maxLength }}</div>
				<slot name="footer-right-r"></slot>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { usedEvents } from '@hub-client/composables/useFormInputEvents';

	import TextArea from '@hub-client/new-design/components/forms/TextArea.vue';

	const props = withDefaults(
		defineProps<{
			modelValue: string;
			placeholder?: string;
			maxLength?: number;
			disabled?: boolean;
			isInline?: boolean;
		}>(),
		{
			isInline: false,
		},
	);

	const emit = defineEmits([...usedEvents, 'caretPos']);
</script>
