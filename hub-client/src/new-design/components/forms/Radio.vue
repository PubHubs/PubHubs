<template>
	<div
		class="form-radio flex w-fit cursor-pointer items-center justify-start gap-200"
		@click.stop.prevent="select(value)"
		@focusin="setFocus(true)"
		@focusout="setFocus(false)"
	>
		<div
			v-if="model === value"
			class="inline-flex h-300 w-300 flex-col items-center justify-center gap-100"
		>
			<div
				class="bg-on-accent-blue outline-accent-blue p-050 outline-offset-050 flex flex-col items-start justify-center rounded-[999px] outline"
				:class="{ 'ring-accent-blue ring-3': hasFocus }"
			>
				<div class="bg-accent-blue h-100 w-100 rounded-full" />
			</div>
		</div>
		<div
			v-else
			class="inline-flex h-300 w-300 flex-col items-center justify-center gap-100"
		>
			<div
				class="bg-surface-base border-surface-on-surface-dim border-thin h-200 w-200 rounded-[999px]"
				:class="{ 'ring-button-blue ring-3': hasFocus }"
			/>
		</div>

		<input
			:id="uniqueValueId"
			class="sr-only"
			type="radio"
			:value="model"
		/>

		<div class="pt-thin inline-flex flex-col items-start justify-center">
			<label
				class="text-surface-on-surface cursor-pointer justify-start"
				:for="uniqueValueId"
				@click.stop.prevent="select(value)"
				><slot
			/></label>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// New design
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			name?: string;
			value?: string;
		}>(),
		{
			name: '',
			value: '',
		},
	);

	const model = defineModel<string | number | null>();

	const { id, setFocus, hasFocus, select } = useFormInput(props, model);

	// Computed
	const uniqueValueId = computed(() => {
		if (id) return id.value + '_' + props.value.toString();
		return props.value.toString();
	});
</script>
