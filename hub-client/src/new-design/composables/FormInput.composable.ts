// Packages
import { computed, getCurrentInstance, ref, useSlots } from 'vue';

// Logic
import { firstToUpper } from '@hub-client/logic/core/extensions';

export function useFormInput(props: any, model: any | undefined = undefined) {
	const changed = ref(false);
	const hasFocus = ref(false);


	const id = computed(() => {
		if (props.id) return props.id;
		return 'id-' + getCurrentInstance()?.uid;
	});

	const slotDefault = computed(()=>{
		const slots = useSlots();
		if (slots.default) {
			return slots.default()[0].children?.toString() as string;
		}
		return '';
	});

	// Set fieldname explicitly in props, or if not set explicitly, it will use the 'label' inside the default slot as fieldname
	const fieldName = computed(() => {
		let name = '';
		if (props.name) {
			name = props.name;
		} else {
			name = slotDefault.value;
		}
		return firstToUpper(name);
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

	return { id, slotDefault, fieldName, setFocus, hasFocus, update, select, toggle, changed };
}
