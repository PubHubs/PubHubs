/**
 * Add global directive v-tw-class that merges component tailwind classes and overrides them as expected
 */

import { twMerge } from 'tailwind-merge';
import { DirectiveBinding, VNode } from 'vue';

const focus = {
    mounted(el: HTMLElement) {
        el.focus()
    }
}


const twClass = {
    mounted: (el: HTMLElement, binding: DirectiveBinding, vnode: VNode) => {
        let classes = '';
        if (vnode.props !== null && typeof (vnode.props.class) == 'string') {
            classes = twMerge(binding.value, vnode.props.class);
        }
        else {
            classes = binding.value;
        }
        const classesList = classes.split(' ');
        classesList.forEach( (item) => {
            el.classList.add( item );
        } )
    }
}

export { focus, twClass }
