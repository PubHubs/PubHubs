import { ref, reactive } from 'vue';

type FormDataType = string | number | boolean;

type FormValidation = {
	required?: boolean;
	// type: string;
	// param?: string | number;
};

type FormData = {
	[key: string]: {
		value: FormDataType;
		validation?: FormValidation;
	};
};

const useFormState = () => {
	const message = ref('');
	const changed = ref(false);
	const validated = ref(false);
	const data = reactive({} as FormData);
	const originalData = {} as FormData;

	const setData = (set: FormData) => {
		changed.value = false;
		validated.value = false;
		Object.keys(set).forEach((key) => {
			originalData[key] = { ...set[key] };
			data[key] = { ...set[key] };
		});
	};

	const updateData = (key: string, value: FormDataType) => {
		data[key].value = value;
		changed.value = false;
		validated.value = true;
		Object.keys(data).forEach((key) => {
			if (JSON.stringify(originalData[key]) != JSON.stringify(data[key])) {
				changed.value = true;
			}
			if (data[key].validation !== undefined) {
				if (data[key].validation?.required && data[key].value !== '') {
					validated.value = validated.value && true;
				} else {
					validated.value = false;
				}
			}
		});
	};

	const dataIsChanged = (key: string) => {
		return JSON.stringify(data[key]) != JSON.stringify(originalData[key]);
	};

	const isValidated = () => {
		return validated.value;
	};

	const isChanged = () => {
		return changed.value;
	};

	const setMessage = (text: string) => {
		message.value = text;
		window.setTimeout(() => {
			message.value = '';
		}, 3000);
	};

	return { originalData, changed, validated, isChanged, isValidated, data, setData, updateData, dataIsChanged, message, setMessage };
};

export { useFormState, type FormDataType };
