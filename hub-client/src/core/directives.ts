/**
 * Add global directive v-tw-class that merges component tailwind classes and overrides them as expected
 */

import { twMerge } from 'tailwind-merge';
import { DirectiveBinding, VNode } from 'vue';

const focus = {
	mounted(el: HTMLElement) {
		el.focus();
	},
};

const twClass = {
	mounted: (el: HTMLElement, binding: DirectiveBinding, vnode: VNode) => {
		let classes = '';
		if (vnode.props !== null && typeof vnode.props.class == 'string') {
			classes = twMerge(binding.value, vnode.props.class);
		} else {
			classes = binding.value;
		}
		const classesList = classes.split(' ');
		classesList.forEach((item) => {
			el.classList.add(item);
		});
	},
};

const clickOutside = {
	beforeMount(el: any, binding: any) {
		el.clickOutsideEvent = function (event: Event) {
			// Check if the clicked element is neither the element
			// to which the directive is applied nor its child
			if (!(el === event.target || el.contains(event.target))) {
				// Invoke the provided method
				binding.value(event);
			}
		};
		document.addEventListener('click', el.clickOutsideEvent);
	},
	unmounted(el: any) {
		// Remove the event listener when the bound element is unmounted
		document.removeEventListener('click', el.clickOutsideEvent);
	},
};

export { focus, twClass, clickOutside };
