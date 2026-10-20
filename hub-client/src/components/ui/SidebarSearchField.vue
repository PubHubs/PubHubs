<template>
	<div class="bg-surface-sunken rounded-base outline-accent-blue-interactive flex items-center gap-100 px-150 py-100 focus-within:outline-3">
		<Icon
			class="text-on-surface-dim"
			size="sm"
			type="magnifying-glass"
		/>
		<input
			ref="input"
			v-model="model"
			class="text-label-small placeholder:text-on-surface-dim w-full border-none bg-transparent focus:ring-0 focus:outline-0"
			:placeholder="placeholder"
			role="searchbox"
			type="text"
		/>
		<button
			v-if="model"
			:aria-label="t('others.clear_search')"
			class="text-on-surface-dim hover:text-on-surface"
			:title="t('others.clear_search')"
			type="button"
			@click="clear()"
		>
			<Icon
				size="sm"
				type="x"
			/>
		</button>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps<{
		placeholder: string;
	}>();

	const emit = defineEmits<{
		clear: [];
	}>();

	const model = defineModel<string>({ required: true });

	const { t } = useI18n();
	const input = ref<HTMLInputElement | null>(null);

	const focus = () => {
		input.value?.focus();
	};

	const clear = () => {
		model.value = '';
		emit('clear');
		focus();
	};

	defineExpose({ focus });
</script>
