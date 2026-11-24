<template>
	<div
		v-click-outside="close"
		class="relative"
	>
		<button
			class="bg-surface-sunken text-on-surface outline-accent-blue-interactive text-label-small flex min-h-550 w-full items-center gap-100 rounded-full px-200 py-100 font-medium transition select-none hover:cursor-pointer hover:opacity-75 focus:outline-3 disabled:cursor-not-allowed disabled:opacity-50"
			:aria-expanded="open"
			aria-haspopup="menu"
			:aria-label="label"
			:disabled="options.length === 0"
			type="button"
			@click="open = !open"
		>
			<Icon
				aria-hidden="true"
				:type="icon"
			/>
			<span class="grow truncate text-left">{{ model?.label || placeholder }}</span>
			<Icon
				aria-hidden="true"
				size="sm"
				type="caret-down"
				weight="fill"
			/>
		</button>

		<div
			v-show="open"
			class="bg-surface-elevated outline-on-surface-dim absolute bottom-full z-50 mb-100 max-h-[40vh] w-full overflow-x-hidden overflow-y-auto rounded outline-2 lg:max-h-4000 lg:w-max lg:max-w-6000 lg:min-w-full"
			role="menu"
		>
			<DropDownOption
				v-for="option in options"
				:key="option.value"
				:active="option.value === model?.value"
				tabindex="0"
				:value="option"
				@click="select(option)"
				@keydown.enter="select(option)"
				@keydown.space.prevent="select(option)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import DropDownOption from '@hub-client/components/forms/elements/DropDownOption.vue';

	// Models
	import { type FieldOption } from '@hub-client/models/validation/TFormOption';

	// Props
	defineProps<{
		icon: string;
		label: string;
		options: FieldOption[];
		placeholder: string;
	}>();

	const model = defineModel<FieldOption>();

	const open = ref(false);

	const close = () => {
		open.value = false;
	};

	const select = (option: FieldOption) => {
		model.value = option;
		close();
	};
</script>
