// Packages
import { computed, getCurrentInstance, onMounted, ref, useSlots } from 'vue';

import { firstToUpper } from '@hub-client/logic/core/extensions';

export function useFormInput(props: any, model: any | undefined = undefined) {
	const changed = ref(false);
	const hasFocus = ref(false);

	// Set fieldname explicitly in props, or if not set explicitly, it will use the 'label' inside the default slot as fieldname
	const fieldName = computed(() => {
		let name = '';
		if (props.name !== '') {
			name = props.name;
		} else {
			const slots = useSlots();
			if (slots.default) {
				name = slots.default()[0].children?.toString() as string;
			}
		}
		return firstToUpper(name);
	});

	// For radio inputs
	const id = computed(() => {
		return 'id-' + getCurrentInstance()?.uid;
	});

	const setFocus = (state: boolean) => {
		hasFocus.value = state;
	};

	const update = () => {
		changed.value = true;
	};

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

	return { fieldName, id, setFocus, hasFocus, update, select, toggle, changed };
}
