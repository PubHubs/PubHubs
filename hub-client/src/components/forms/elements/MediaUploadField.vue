<template>
	<ValidateField
		v-model="model"
		:name="name"
		:validation="{}"
		:help="description"
	>
		<div class="flex flex-col gap-200">
			<Label>{{ title }}</Label>

			<div class="flex h-14">
				<input
					:id="inputId"
					:accept="accept"
					class="hidden"
					type="file"
					@change="handleFileChange"
				/>

				<div class="mr-200">
					<slot
						name="preview"
						:url="previewUrl"
					/>
				</div>

				<div class="flex items-center gap-100">
					<label
						:for="inputId"
						class="hover:text-accent-green cursor-pointer"
					>
						<Icon type="pencil-simple" />
					</label>
					<Icon
						class="hover:text-accent-error cursor-pointer"
						:as-button="true"
						type="trash"
						@click="handleRemove"
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
	</ValidateField>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Label from '@hub-client/components/forms/elements/Label.vue';
	import ValidateField from '@hub-client/components/forms/elements/ValidateField.vue';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';

	const props = withDefaults(
		defineProps<{
			title: string;
			description: string;
			accept: string;
			initialUrl: string;
			defaultUrl: string;
			maxSize?: number;
			name?: string;
			saveError?: string;
		}>(),
		{
			maxSize: undefined,
			name: undefined,
			saveError: undefined,
		},
	);

	const model = defineModel<File | null>();

	const { t } = useI18n();
	const blobManager = ref<BlobManager | null>(null);
	const postSaveBlobManager = ref<BlobManager | null>(null);
	const internalError = ref<string | undefined>(undefined);
	const errorText = computed(() => props.saveError ?? internalError.value);
	const inputId = `media-upload-${getCurrentInstance()?.uid ?? 0}`;

	const previewUrl = computed(() => {
		if (model.value instanceof File) return blobManager.value?.url ?? '';
		if (model.value === null) return props.defaultUrl;
		return postSaveBlobManager.value?.url ?? props.initialUrl;
	});

	// When the parent resets model from File → undefined after a save, preserve the blob URL for display.
	watch(
		() => model.value,
		(newVal, oldVal) => {
			if (newVal === undefined && oldVal instanceof File && blobManager.value) {
				postSaveBlobManager.value?.revoke();
				postSaveBlobManager.value = blobManager.value;
				blobManager.value = null;
			}
		},
	);

	onBeforeUnmount(() => {
		blobManager.value?.revoke();
		postSaveBlobManager.value?.revoke();
	});

	function handleFileChange(event: Event) {
		internalError.value = undefined;

		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const allowedTypes = props.accept.split(',').map((type) => type.trim());
		if (!allowedTypes.includes(file.type)) {
			internalError.value = t('hub_settings.file_format_not_allowed').toString();
			return;
		}

		if (props.maxSize !== undefined && file.size > props.maxSize) {
			internalError.value = t('hub_settings.file_too_large').toString();
			return;
		}

		postSaveBlobManager.value?.revoke();
		postSaveBlobManager.value = null;
		blobManager.value?.revoke();
		blobManager.value = new BlobManager(file);
		model.value = file;
	}

	function handleRemove() {
		postSaveBlobManager.value?.revoke();
		postSaveBlobManager.value = null;
		blobManager.value?.revoke();
		blobManager.value = null;
		model.value = null;
	}
</script>
