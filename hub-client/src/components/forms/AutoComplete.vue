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
			class="w-full rounded-lg border px-2 py-1 focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0 theme-light:border-black theme-light:text-black dark:border-white dark:bg-transparent dark:text-white"
			:placeholder="$t('others.typing')"
			:disabled="disabled === true"
		/>
		<ul v-if="result.length > 0" class="absolute z-50 w-full rounded-lg border border-black bg-white px-2 py-1 shadow-md">
			<li v-for="(item, index) in result" :key="index" @click="click(item)" class="cursor-pointer text-black" :class="{ 'bg-lightgray': cursor === index }">
				{{ item.label }}
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, computed } from 'vue';
	import { InputType, Options, useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { useKeyStrokes } from '@/composables/useKeyStrokes';

	type Props = {
		options: Options;
		value: string | Object;
		disabled: Boolean;
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
		if (search.value === '' || search.value === undefined || props.options.find((attribute) => search.value?.toString().toLowerCase() === attribute.label.toLowerCase())) {
			setItems([]);
			return [];
		}

		let matches = 0;

		const result = props.options.filter((item) => {
			const searchValue = search.value?.toString() || '';
			if (item.label.toLowerCase().includes(searchValue.toLowerCase()) && matches < 10 && item.label.toLowerCase() !== searchValue.toLowerCase()) {
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
</script>
