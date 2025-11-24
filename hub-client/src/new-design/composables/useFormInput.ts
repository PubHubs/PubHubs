// Packages
import { computed, getCurrentInstance } from 'vue';

export function useFormInput(model: any, input: any) {
	const id = computed(() => {
		return 'radio-' + getCurrentInstance()?.uid;
	});

	const toggle = () => {
		input.value?.click();
	};

	const update = (checked: boolean) => {
		model.value = checked;
	};

	return { id, toggle, update };
}
