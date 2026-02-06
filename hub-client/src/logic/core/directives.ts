// Packages
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
		if (vnode.props !== null && typeof vnode.props.class === 'string') {
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

const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

const contextMenu = {
	mounted(el: any, binding: DirectiveBinding) {
		let timer: ReturnType<typeof setTimeout> | null = null;
		let startPos = { x: 0, y: 0 };

		el._contextMenuHandler = binding.value;

		el._onContextMenu = (e: Event) => {
			el._contextMenuHandler(e);
		};

		el._onTouchStart = (e: TouchEvent) => {
			const touch = e.touches[0];
			startPos = { x: touch.clientX, y: touch.clientY };

			timer = setTimeout(() => {
				timer = null;
				el.dispatchEvent(new MouseEvent('contextmenu', { clientX: touch.clientX, clientY: touch.clientY, bubbles: true }));
			}, LONG_PRESS_DURATION);
		};

		el._onTouchMove = (e: TouchEvent) => {
			if (!timer) return;
			const touch = e.touches[0];
			if (Math.abs(touch.clientX - startPos.x) > LONG_PRESS_MOVE_THRESHOLD || Math.abs(touch.clientY - startPos.y) > LONG_PRESS_MOVE_THRESHOLD) {
				clearTimeout(timer);
				timer = null;
			}
		};

		el._onTouchEnd = () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		};

		el.addEventListener('contextmenu', el._onContextMenu);
		el.addEventListener('touchstart', el._onTouchStart, { passive: true });
		el.addEventListener('touchmove', el._onTouchMove, { passive: true });
		el.addEventListener('touchend', el._onTouchEnd);
		el.addEventListener('touchcancel', el._onTouchEnd);

		el.style.setProperty('-webkit-touch-callout', 'none');
		el.style.setProperty('user-select', 'none');
		el.style.setProperty('-webkit-user-select', 'none');
	},

	updated(el: any, binding: DirectiveBinding) {
		el._contextMenuHandler = binding.value;
	},

	unmounted(el: any) {
		if (el._onContextMenu) el.removeEventListener('contextmenu', el._onContextMenu);
		if (el._onTouchStart) el.removeEventListener('touchstart', el._onTouchStart);
		if (el._onTouchMove) el.removeEventListener('touchmove', el._onTouchMove);
		if (el._onTouchEnd) {
			el.removeEventListener('touchend', el._onTouchEnd);
			el.removeEventListener('touchcancel', el._onTouchEnd);
		}
	},
};

// Exports
export { focus, twClass, clickOutside, contextMenu };
