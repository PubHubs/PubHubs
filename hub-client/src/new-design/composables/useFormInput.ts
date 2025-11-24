// Packages
import { computed, getCurrentInstance, ref } from 'vue';

export type inputValidation = {
    required?: boolean;
    max_length?: number;
    min_length?: number;
    isNumber?:boolean;
    min?:number;
    max?:number;
    // Mandatory checks for allowing empty values
    // allow_empty_text: boolean;
    // allow_empty_number: boolean;
    // allow_empty_object: boolean;
};

export const defaultValidation = {
    required:false,
}

const validateFunctions = {

    required : (value:number|string, validation:inputValidation) => {
        return value !== '';
    },

    min_length : (value:string, validation:inputValidation) => {
        return value.length >= validation.min_length!;
    },

    max_length : (value:string, validation:inputValidation) => {
        return value.length < validation.max_length!;
    },

}
//  as [key: string]: {
// };



export function useFormInput(model: any, validation : any|undefined = undefined) {

    const changed = ref(false);

    // For radio inputs
    const id = computed(() => {
		return 'id-' + getCurrentInstance()?.uid;
	});

    // For radio inputs
    const select = (value:string|number|boolean) => {
        if (model.value===value) {
            model.value = null;
        }
        else {
            model.value = value;
        }
        changed.value = true;
    };

    // For checkbox and toggle inputs
	const toggle = (disabled :boolean = false) => {
        if (!disabled) {
            model.value = !model.value;
            changed.value = true;
        }
	};

    const validated = computed(() => {
        let validated = true;
        if (model.value || changed.value) {
            changed.value = true;
            Object.keys(validation).forEach((key) => {
                // const func = validateFunctions[key];
                validated = validated && validateFunctions.required(model.value,validation);
            });
        }
        console.info('validated',model.value, validation, validated);
        return validated;
    });

    const validationError = computed(() => {
        if (!validated.value) {
            return 'ERROR';
        }
        return '';
    });

	return { id, select, toggle, changed, validated, validationError };
}
