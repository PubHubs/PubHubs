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
		<input
			type="text"
			v-model="search"
			class="w-full rounded-lg border bg-background px-2 py-1 text-label placeholder:text-surface-subtle focus:ring-accent-primary"
			:placeholder="$t('admin.editroom_typing')"
			:disabled="disabled === true"
			:maxlength="maxlength"
		/>
		<ul v-if="result.length > 0" class="absolute z-50 w-full rounded-lg border bg-background px-2 py-1 shadow-md">
			<li v-for="(item, index) in result" :key="index" @click="click(item)" class="cursor-pointer" :class="{ '': cursor === index }">
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
