<template>
	<div class="flex flex-col gap-200">
		<div class="gap-075 flex flex-col">
			<Label>{{ title }}</Label>
			<p>{{ description }}</p>
		</div>

		<div class="flex h-14">
			<input
				ref="fileInput"
				:accept="accept"
				class="hidden"
				type="file"
				@change="handleFileChange"
			/>

			<div class="">
				<slot name="preview" />
			</div>

			<div>
				<Icon
					:as-button="true"
					size="md"
					type="pencil-simple"
					@click="fileInput?.click()"
				/>
				<Icon
					:as-button="true"
					size="md"
					type="trash"
					@click="$emit('remove')"
				/>
			</div>
		</div>
		<p
			v-if="errorText"
			class="text-red"
		>
			{{ errorText }}
		</p>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// New design
	import Label from '@hub-client/new-design/components/forms/Label.vue';

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
