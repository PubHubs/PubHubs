// Packages
import { computed, getCurrentInstance, ref } from 'vue';

export function useFormInput(model: any | undefined = undefined) {
	const changed = ref(false);
	const hasFocus = ref(false);

	const setFocus = (state: boolean) => {
		hasFocus.value = state;
	};

	// For radio inputs
	const id = computed(() => {
		return 'id-' + getCurrentInstance()?.uid;
	});

	// For radio inputs
	const select = (value: string | number | boolean) => {
		if (model.value === value) {
			model.value = null;
		} else {
			model.value = value;
		}
		changed.value = true;
	};

	// For checkbox and toggle inputs
	const toggle = (disabled: boolean = false) => {
		if (!disabled) {
			model.value = !model.value;
			changed.value = true;
		}
	};

	return { id, setFocus, hasFocus, select, toggle, changed };
}
