// Packages
import { ref } from 'vue';

const useKeyStrokes = () => {
	const items = ref([] as Array<any>);
	const cursor = ref(0);
	const selected = ref(undefined as any);

	const setItems = (newItems: Array<any>) => {
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

	const selectItem = (item: any) => {
		selected.value = item;
		cursor.value = 0;
	};

	const selectItemByEnter = (): any => {
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
