<template>
	<div>
		<div class="mb-4 flex-col">
			<H3 class="pb-2 text-lg font-semibold">{{ title }}</H3>
			<p>{{ description }}</p>
		</div>

		<div class="h-14 mb-2 flex">
			<input :accept="accept" ref="fileInput" type="file" class="hidden" @change="handleFileChange" />

			<div class="">
				<slot name="preview"></slot>
			</div>

			<div>
				<Icon @click="fileInput?.click()" type="edit" size="md" :as-button="true"></Icon>
				<Icon @click="$emit('remove')" type="bin" size="md" :as-button="true"></Icon>
			</div>
		</div>
		<p v-if="errorText" class="text-red">{{ errorText }}</p>
	</div>
</template>

<script setup lang="ts">
	import Icon from '@/components/elements/Icon.vue';
	import H3 from '@/components/elements/H3.vue';
	import { ref } from 'vue';

	defineProps({
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
			required: true,
		},
		mediaUrl: {
			type: String,
			required: true,
		},
		accept: {
			type: String,
			required: true,
		},
		errorText: {
			type: String,
			default: undefined,
		},
	});

	const emit = defineEmits(['file-change', 'remove']);
	const fileInput = ref<HTMLInputElement | null>(null);

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			emit('file-change', file);
		}
	}
</script>
