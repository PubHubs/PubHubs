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
		<TextField v-model="search" :placeholder="$t('admin.editroom_typing')" :disabled="disabled === true" :validation="{ maxLength: maxlength }"><slot></slot></TextField>
		<ul
			v-if="result.length > 0"
			class="text-on-surface-dim bg-surface-base outline-offset-thin -mt-075 outline-on-accent-primary ring-on-accent-primary absolute z-50 w-full justify-start rounded-lg rounded-t-none border border-t-0 px-175 py-100 ring-3 outline"
		>
			<li v-for="(item, index) in result" :key="index" @click="click(item)" class="hover:text-on-surface-bright cursor-pointer" :class="{ '': cursor === index }">
				{{ item }}
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

	// Types
	type Props = {
		options: Array<String>;
		value: string | Object;
		disabled?: Boolean;
		maxlength?: number;
	};

	const props = withDefaults(defineProps<Props>(), {
		value: undefined,
		disabled: undefined,
	});

	const emit = defineEmits(usedEvents);
	const { value: search, setValue, update } = useFormInputEvents(emit);
	const { setItems, cursor, cursorDown, cursorUp, reset, selectItem, selectItemByEnter } = useKeyStrokes();

	onMounted(() => {
		setValue(props.value as InputType);
	});

	const result = computed(() => {
		if (search.value === '' || search.value === undefined || props.options.find((attribute) => search.value?.toString().toLowerCase() === attribute?.toLowerCase())) {
			setItems([]);
			return [];
		}

		let matches = 0;

		const result = props.options.filter((item) => {
			const searchValue = search.value?.toString() || '';
			if (item?.toLowerCase().includes(searchValue.toLowerCase()) && matches < 10 && item.toLowerCase() !== searchValue.toLowerCase()) {
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
		setValue(item);
		update(item);
	};

	const click = (item: any) => {
		setValue(item);
		update(item);
	};

	// Watch for manual input and update output value even if not in the list
	watch(search, (newValue) => {
		if (typeof newValue === 'string') {
			update(newValue);
		}
	});
	watch(
		() => props.value,
		(newValue) => {
			setValue(newValue as InputType);
		},
	);
</script>
