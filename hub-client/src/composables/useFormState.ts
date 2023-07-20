import { ref, reactive } from 'vue';

type FormDataType = string | number;
type FormData = { [key: string]: FormDataType };

const useFormState = () => {
	const message = ref('');
	const changed = ref(false);
	const data = reactive({} as FormData);
	const originalData = {} as FormData;

	const setData = (set: FormData) => {
		Object.keys(set).forEach((key) => {
			originalData[key] = set[key];
			data[key] = set[key];
		});
	};

	const updateData = (key: string, value: FormDataType) => {
		data[key] = value;
		changed.value = false;
		Object.keys(data).forEach((key) => {
			if (JSON.stringify(originalData[key]) != JSON.stringify(data[key])) {
				changed.value = true;
			}
		});
	};

	const dataIsChanged = (key: string) => {
		return JSON.stringify(data[key]) != JSON.stringify(originalData[key]);
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

	return { originalData, changed, isChanged, data, setData, updateData, dataIsChanged, message, setMessage };
};

export { useFormState, type FormDataType };
