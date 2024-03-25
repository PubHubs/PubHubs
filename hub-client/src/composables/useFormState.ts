import { ref, reactive } from 'vue';
import { DialogButton } from '@/store/dialog';

type FormDataType = string | number | boolean;

type FormValidation = {
	required?: boolean;
	max_length?: number;
	min_length?: number;
};

type ShowValidationMessage = {
	required?: boolean;
	max_length?: boolean;
	min_length?: boolean;
};

type FormData = {
	[key: string]: {
		value: FormDataType;
		validation?: FormValidation;
		show_validation?: ShowValidationMessage;
		tmp?: any;
	};
};

type ValidationErrors = {
	[key: string]: {
		error: string;
		field: string;
		param?: number | string;
	};
};

const useFormState = () => {
	const message = ref('');
	const changed = ref(false);
	const validated = ref(false);
	const validationErrors = ref({} as ValidationErrors);
	const data = reactive({} as FormData);
	const originalData = {} as FormData;
	const submitButton = ref(undefined as undefined | DialogButton);
	const submitTestValidated = ref(true);

	/**
	 * If the form is used in a Dialog, set the submit button of the dialog here.
	 * The Sumbit will be enabled/disabled reflecting the state of the form.
	 */
	const setSubmitButton = (button: DialogButton) => {
		submitButton.value = button;
		submitButton.value.enabled = false;
	};

	/**
	 * If a submit button is set, standard validation of the button is checking on isValidated and isChanged.
	 * In some cases a form needs only a isChanged test to enable the submit button. Use this method to set testing on validation on/off.
	 */
	const setSubmitTestOnValidation = (test: boolean) => {
		submitTestValidated.value = test;
	};

	const setData = (set: FormData) => {
		changed.value = false;
		validated.value = false;
		Object.keys(set).forEach((key) => {
			originalData[key] = { ...set[key] };
			data[key] = { ...set[key] };
		});
		// console.log('setData',data);
	};

	const updateData = (key: string, value: FormDataType) => {
		data[key].value = value;
		const originalValue = originalData[key];

		changed.value = false;
		validated.value = true;

		let isValidated = true;
		validationErrors.value = {} as ValidationErrors;
		Object.keys(data).forEach((key) => {
			const value = data[key].value;

			// Changed?
			if (JSON.stringify(originalValue) != JSON.stringify(value)) {
				changed.value = true;
			}

			// Validation
			if (data[key].validation !== undefined) {
				// required
				if (isValidated) {
					if (data[key].validation?.required) {
						if ((typeof value === 'object' && value === null) || (typeof value === 'string' && value === '') || (typeof value === 'number' && (value === null || value === undefined))) {
							isValidated = false;
							if (data[key].show_validation === undefined || data[key].show_validation?.required) {
								validationErrors.value[key] = { error: 'validation.required', field: key };
							}
						}
					}
				}

				// max_length (string)
				if (isValidated && typeof value === 'string') {
					if (data[key].validation?.max_length) {
						const max_length = data[key].validation?.max_length as number;
						const value = data[key].value as string;
						if (value.length > max_length) {
							isValidated = false;
							if (data[key].show_validation === undefined || data[key].show_validation?.max_length) {
								validationErrors.value[key] = { error: 'validation.max_length', field: key, param: max_length };
							}
						}
					}
				}

				// min_length (string)
				if (isValidated && typeof value === 'string') {
					if (data[key].validation?.min_length) {
						const min_length = data[key].validation?.min_length as number;
						const value = data[key].value as string;
						if (value.length < min_length) {
							isValidated = false;
							if (data[key].show_validation === undefined || data[key].show_validation?.min_length) {
								validationErrors.value[key] = { error: 'validation.min_length', field: key, param: min_length };
							}
						}
					}
				}

				// console.log('validation',key,value,isValidated);
				validated.value = isValidated;
			}
		});

		if (submitButton.value !== undefined) {
			if ((submitTestValidated.value && validated.value && changed.value) || (!submitTestValidated.value && changed.value)) {
				submitButton.value.enabled = true;
			} else {
				submitButton.value.enabled = false;
			}
		}
	};

	const dataIsChanged = (key: string = '') => {
		let isChanged = false;
		if (key === '') {
			Object.keys(data).forEach((item) => {
				isChanged = isChanged || JSON.stringify(data[item].value) != JSON.stringify(originalData[item].value);
				// console.log('dataIsChanged',item,originalData[item].value,data[item].value,isChanged);
			});
		} else {
			isChanged = JSON.stringify(data[key].value) != JSON.stringify(originalData[key].value);
		}
		// console.log('dataIsChanged',key,originalData[key].value,data[key].value,isChanged);
		return isChanged;
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

	return { originalData, changed, validated, isChanged, isValidated, validationErrors, data, setSubmitButton, setSubmitTestOnValidation, setData, updateData, dataIsChanged, message, setMessage };
};

export { useFormState, type FormDataType, type ValidationErrors };
