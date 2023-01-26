/**
 * Add global directive v-tw-class that merges component tailwind classes and overrides them as expected
 */

import { twMerge } from 'tailwind-merge';

const twClass = {
    mounted: (el:any,binding:any,vnode:any) => {
        if ( vnode.props!==null && typeof(vnode.props.class)=='string' ) {
            el.classList = twMerge(binding.value,vnode.props.class);
        }
        else {
            el.classList = binding.value;
        }
    }
}

export { twClass }
