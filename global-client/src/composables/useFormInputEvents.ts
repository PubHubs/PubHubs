/**
 *
 * This composable can be used in form input components. It consists of the basic parts every input should have and some interfaces for common types
 * - a value
 * - handling of basic events (change,submit,cancel)
 * - Option & Options types for select inputs
 *
 * Usage:
 *
 *      import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
 *
 *      // Need to give the events context to the composable (emit)
 *
 *      const emit = defineEmits(usedEvents);
 *      const { value, changed, submit, cancel } = useFormInputEvents(emit);
 *
 *      // If you need to set the value (according to a propperty of the component for example):
 *
 *      const emit = defineEmits(usedEvents);
 *      const { value, setValue, changed, submit, cancel } = useFormInputEvents(emit);
 *      setValue(props.value);
 *
 */

import { ref, PropType } from 'vue';

interface Option {
    label: string,
    value : any,
}

type Options = Array<Option>


const usedEvents = ['update','changed','cancel'];

const useFormInputEvents = (emit:any) => {

    const value:any = ref('');

    let options = Array as PropType<Options>;

    const setValue = ( set:any ) => {
        value.value = set;
    }

    const setOptions = ( set:any ) => {
        options = set;
    }

    const selectOption = ( option:Option ) => {
        value.value = option.value;
    }

    const optionIsSelected = ( option:Option ) => {
        return ( JSON.stringify(value.value) == JSON.stringify(option.value) ) ;
    }

    const changed = () => {
        emit('changed', value.value);
    }

    const submit = () => {
        if (value.value !== '') {
            emit('submit', value.value);
        }
        value.value = '';
    }

    const cancel = () => {
        value.value = '';
        emit('cancel');
    }

    return { value, setValue, options, setOptions, selectOption, optionIsSelected, changed, submit, cancel }
}


export { Option, Options, useFormInputEvents, usedEvents };

