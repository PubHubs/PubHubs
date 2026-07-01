// Packages
import type { IOptions as SanitizeOptions } from 'sanitize-html';
import { twMerge } from 'tailwind-merge';
import { type DirectiveBinding, type VNode } from 'vue';

// Logic
import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('Directives');

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

interface ClickOutsideElement extends HTMLElement {
	clickOutsideEvent?: (event: Event) => void;
}

const clickOutside = {
	beforeMount(el: ClickOutsideElement, binding: DirectiveBinding) {
		logger.debug('clickOutside', el, binding);
		el.clickOutsideEvent = function (event: Event) {
			// Check if the clicked element is neither the element
			// to which the directive is applied nor its child
			if (!(el === event.target || el.contains(event.target as Node))) {
				// Invoke the provided method
				binding.value(event);
			}
		};
		document.addEventListener('click', el.clickOutsideEvent);
	},
	unmounted(el: ClickOutsideElement) {
		// Remove the event listener when the bound element is unmounted
		if (el.clickOutsideEvent) {
			document.removeEventListener('click', el.clickOutsideEvent);
		}
	},
};

const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

interface ContextMenuElement extends HTMLElement {
	_contextMenuHandler?: (e: Event) => void;
	_onContextMenu?: (e: Event) => void;
	_onTouchStart?: (e: TouchEvent) => void;
	_onTouchMove?: (e: TouchEvent) => void;
	_onTouchEnd?: () => void;
}

const contextMenu = {
	mounted(el: ContextMenuElement, binding: DirectiveBinding) {
		let timer: ReturnType<typeof setTimeout> | null = null;
		let startPos = { x: 0, y: 0 };

		el._contextMenuHandler = binding.value;

		el._onContextMenu = (e: Event) => {
			if (typeof el._contextMenuHandler === 'function') el._contextMenuHandler(e);
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

		// Only disable text selection on touch devices
		if (window.matchMedia('(pointer: coarse)').matches) {
			el.style.setProperty('-webkit-touch-callout', 'none');
			el.style.setProperty('user-select', 'none');
			el.style.setProperty('-webkit-user-select', 'none');
		}
	},

	updated(el: ContextMenuElement, binding: DirectiveBinding) {
		el._contextMenuHandler = binding.value;
	},

	unmounted(el: ContextMenuElement) {
		if (el._onContextMenu) el.removeEventListener('contextmenu', el._onContextMenu);
		if (el._onTouchStart) el.removeEventListener('touchstart', el._onTouchStart);
		if (el._onTouchMove) el.removeEventListener('touchmove', el._onTouchMove);
		if (el._onTouchEnd) {
			el.removeEventListener('touchend', el._onTouchEnd);
			el.removeEventListener('touchcancel', el._onTouchEnd);
		}
	},
};

// ──────────────────────────────────────────────────────────────────────────────
// v-safe-html directive
//
// Replacement for v-html that automatically sanitizes before rendering.
// Sanitization only for elements that are insinde the viewport (IntersectionObserver + a 400 px buffer).
// Raw HTML is kept in memory outside the DOM to avoid creating other possible XSS problems.
//
// Usage:
//   v-safe-html="rawHtmlString"
//   v-safe-html="{ html: rawHtmlString, options: customSanitizeOptions }"
// ──────────────────────────────────────────────────────────────────────────────

type SafeHtmlValue = string | { html: string; options?: SanitizeOptions };

const pendingContent = new WeakMap<Element, SafeHtmlValue>();

let _observer: IntersectionObserver | null = null;
const getObserver = (): IntersectionObserver | null => {
	if (_observer) return _observer;
	if (typeof IntersectionObserver === 'undefined') return null;
	_observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const el = entry.target as HTMLElement;
				const pending = pendingContent.get(el);
				if (pending !== undefined) {
					el.innerHTML = applySanitize(pending);
					pendingContent.delete(el);
				}
				_observer!.unobserve(el);
			}
		},
		{ rootMargin: '400px 0px' },
	);
	return _observer;
};

const applySanitize = (value: SafeHtmlValue): string => {
	if (typeof value === 'string') return sanitizeHtml(value);
	const { html, options } = value;
	return sanitizeHtml(html, options);
};

const getHtml = (value: SafeHtmlValue | null | undefined): string => {
	if (!value) return '';
	return typeof value === 'string' ? value : value.html;
};

const applyToElement = (el: HTMLElement, value: SafeHtmlValue, visible = false) => {
	const obs = getObserver();
	if (!obs || visible) {
		el.innerHTML = applySanitize(value);
		return;
	}
	const rect = el.getBoundingClientRect();
	const nearViewport = rect.bottom > -400 && rect.top < window.innerHeight + 400;
	if (nearViewport) {
		el.innerHTML = applySanitize(value);
	} else {
		el.innerHTML = '';
		pendingContent.set(el, value);
		obs.observe(el);
	}
};

const safeHtml = {
	mounted(el: HTMLElement, binding: DirectiveBinding<SafeHtmlValue>) {
		applyToElement(el, binding.value);
	},
	updated(el: HTMLElement, binding: DirectiveBinding<SafeHtmlValue>) {
		const oldHtml = getHtml(binding.oldValue);
		const newHtml = getHtml(binding.value);
		const oldOptions = typeof binding.oldValue === 'object' ? binding.oldValue?.options : undefined;
		const newOptions = typeof binding.value === 'object' ? binding.value?.options : undefined;
		if (newHtml === oldHtml && newOptions === oldOptions) return;
		if (pendingContent.has(el)) {
			pendingContent.set(el, binding.value);
		} else {
			applyToElement(el, binding.value, true);
		}
	},
	unmounted(el: HTMLElement) {
		if (pendingContent.has(el)) {
			getObserver()?.unobserve(el);
			pendingContent.delete(el);
		}
	},
};

// Exports
export { focus, twClass, clickOutside, contextMenu, SafeHtmlValue, safeHtml };
