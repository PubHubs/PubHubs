<template>
	<!-- role="checkbox" (not the more precise "switch") because link-hint extensions like Vimium only
	     treat a fixed set of roles as clickable, and "switch" isn't one of them; a switch is an ARIA
	     checkbox subtype, so this stays valid while keeping the control hint-targetable. -->
	<div
		class="form-toggle flex items-center justify-start gap-200"
		:class="disabled ? '' : 'cursor-pointer'"
		role="checkbox"
		:aria-checked="model ? 'true' : 'false'"
		:aria-disabled="disabled || undefined"
		:tabindex="disabled ? -1 : 0"
		@click="toggle(disabled)"
		@keydown.enter.prevent="toggle(disabled)"
		@keydown.space.prevent="toggle(disabled)"
		@focusin="setFocus(true)"
		@focusout="setFocus(false)"
	>
		<div
			v-if="!model"
			class="bg-surface-base outline-surface-on-surface-dim px-050 py-050 outline-offset-thin flex items-center justify-start rounded-[999px] outline"
			:class="{ 'ring-accent-blue-interactive ring-3': hasFocus, 'opacity-50': disabled }"
		>
			<div class="bg-on-surface-dim h-150 w-150 rounded-full" />
			<div class="h-150 w-150 rounded-full" />
		</div>
		<div
			v-else
			class="bg-on-accent-blue outline-accent-blue px-050 py-050 outline-050 outline-offset-thin inline-flex items-center justify-start rounded-[999px] outline"
			:class="{ 'ring-accent-blue-interactive ring-3': hasFocus, 'opacity-50': disabled }"
		>
			<div class="h-150 w-150 rounded-full" />
			<div class="bg-accent-blue h-150 w-150 rounded-full" />
		</div>

		<input
			class="sr-only"
			:disabled="disabled"
			type="checkbox"
			tabindex="-1"
			aria-hidden="true"
			:value="model"
		/>

		<div class="pt-thin">
			<label
				class="justify-start"
				:class="disabled ? 'text-on-surface-disabled' : 'text-surface-on-surface cursor-pointer'"
				><slot
			/></label>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// New design
	import { useFormInput } from '@hub-client/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
		}>(),
		{
			disabled: false,
		},
	);

	const model = defineModel<boolean>();

	const { setFocus, hasFocus, toggle } = useFormInput(props, model);
</script>
