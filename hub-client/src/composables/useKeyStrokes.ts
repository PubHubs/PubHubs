// Packages
import { ref } from 'vue';

const useKeyStrokes = () => {
	const items = ref([] as Array<unknown>);
	const cursor = ref(0);
	const selected = ref<unknown>(undefined);

	const setItems = (newItems: Array<unknown>) => {
		items.value = newItems;
		reset();
	};

	const cursorDown = () => {
		if (cursor.value < items.value.length - 1) {
			cursor.value++;
		}
	};

	const cursorUp = () => {
		if (cursor.value > 0) {
			cursor.value--;
		}
	};

	const selectItem = (item: unknown) => {
		selected.value = item;
		cursor.value = 0;
	};

	const selectItemByEnter = (): unknown => {
		if (selected.value === undefined) {
			const item = items.value[cursor.value];
			selected.value = item;
			cursor.value = 0;
		}
		return selected.value;
	};

	const reset = () => {
		cursor.value = 0;
		selected.value = undefined;
	};

	return {
		setItems,
		cursor,
		selected,
		cursorDown,
		cursorUp,
		selectItem,
		selectItemByEnter,
		reset,
	};
};

export { useKeyStrokes };
