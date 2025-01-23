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
			class="w-full border px-2 py-1 rounded-lg dark:bg-transparent theme-light:border-black theme-light:text-black dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
			:placeholder="$t('others.typing')"
			:disabled="disabled === true"
		/>
		<ul v-if="result.length > 1" class="w-full border border-black px-2 py-1 rounded-lg absolute z-50 bg-white shadow-md">
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
		if (search.value === '' || search.value === undefined) {
			setItems([]);
			return [];
		}

		let matches = 0;

		const result = props.options.filter((item) => {
			const searchValue = search.value?.toString() || '';
			if (item.label.toLowerCase().includes(searchValue.toLowerCase()) && matches < 10) {
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
