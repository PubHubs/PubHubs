<template>
	<div
		@keydown.arrow-down.prevent="cursorDown()"
		@keydown.arrow-up.prevent="cursorUp()"
		@keydown.enter.stop="enter()"
		@keydown.esc.stop="
			reset();
			search = undefined;
		"
		class="relative w-full"
	>
		<TextField v-model="search" :placeholder="placeholder" :disabled="disabled === true" :validation="validation">{{ label }}</TextField>

		<ul
			v-if="result.length > 0"
			class="text-on-surface-dim bg-surface-base outline-offset-thin -mt-075 outline-on-accent-primary ring-on-accent-primary absolute z-50 w-full justify-start rounded-lg rounded-t-none border border-t-0 px-175 py-100 ring-3 outline"
		>
			<li v-for="(item, index) in result" :key="index" @click="click(item)" class="hover:text-on-surface-bright cursor-pointer" :class="{ '': cursor === index }">
				{{ item.label }}
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, watch } from 'vue';

	// Composables
	import { InputType, useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';
	import { useKeyStrokes } from '@hub-client/composables/useKeyStrokes';

	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	const search = defineModel<string | number>();

	// Types
	type Props = {
		name?: string;
		placeholder?: string;
		validation?: Object;
		options: Array<any>;
		disabled?: Boolean;
	};

	const props = withDefaults(defineProps<Props>(), {
		name: '',
		placeholder: '',
		validation: undefined,
		disabled: undefined,
	});

	const emit = defineEmits(usedEvents);
	const { slotDefault } = useFormInput(props, search);
	const { setValue, update } = useFormInputEvents(emit);
	const { setItems, cursor, cursorDown, cursorUp, reset, selectItem, selectItemByEnter } = useKeyStrokes();

	onMounted(() => {
		setValue(search.value as InputType);
	});

	const label = computed(() => {
		return props.name ? props.name : slotDefault.value;
	});

	const placeholder = computed(() => {
		return props.placeholder ? props.placeholder : slotDefault.value;
	});

	const labeledOptions = computed(() => {
		if (props.options[0].label) return props.options;
		return props.options.map((item) => {
			return { label: item, value: item };
		});
	});

	const result = computed(() => {
		if (search.value === '' || search.value === undefined || labeledOptions.value.find((item) => search.value?.toString().toLowerCase() === item?.label.toLowerCase())) {
			setItems([]);
			return [];
		}
		let matches = 0;
		const result = labeledOptions.value.filter((item) => {
			const searchValue = (search.value?.toString() || '').toLowerCase();
			const label = item.label.replace(/[^a-zA-Z ]/g, '').toLowerCase();
			if (label.includes(searchValue) && matches < 10 && label.toLowerCase() !== searchValue) {
				matches++;
				return item;
			}
		});
		setItems(result);
		return result;
	});

	const enter = () => {
		const item = selectItemByEnter();
		select(item);
	};

	const select = (item: any) => {
		selectItem(item);
		setValue(item.label);
		update(item.label);
	};

	const click = (item: any) => {
		setValue(item.label);
		update(item.label);
	};

	// Watch for manual input and update output value even if not in the list
	watch(search, (newValue) => {
		if (typeof newValue === 'string') {
			update(newValue);
		}
	});
</script>
