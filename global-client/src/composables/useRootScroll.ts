/**
 * Layout root scroll helpers with Safari snap enforcement.
 */

// Module-level state shared across all callers (global-client and hub-client)
const SCROLL_DURATION = 150;
let isProgrammaticScroll = false;
let animationFrameId: number | null = null;
let scrollEndTimeout: ReturnType<typeof setTimeout>;
let cleanupFn: (() => void) | null = null;

const smoothScrollTo = (element: HTMLElement, targetLeft: number) => {
	if (animationFrameId !== null) {
		cancelAnimationFrame(animationFrameId);
	}
	isProgrammaticScroll = true;
	const startLeft = element.scrollLeft;
	const distance = targetLeft - startLeft;
	const startTime = performance.now();

	const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

	const animateScroll = (currentTime: number) => {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / SCROLL_DURATION, 1);
		const easedProgress = easeOutCubic(progress);

		element.scrollLeft = startLeft + distance * easedProgress;

		if (progress < 1) {
			animationFrameId = requestAnimationFrame(animateScroll);
		} else {
			animationFrameId = null;
			isProgrammaticScroll = false;
		}
	};

	animationFrameId = requestAnimationFrame(animateScroll);
};

/** Snaps to the nearest snap point — workaround for Safari ignoring scroll-snap-type: mandatory. */
const enforceSnap = () => {
	const layoutRoot = document.getElementById('layout-root');
	if (!layoutRoot || isProgrammaticScroll) return;

	const scrollLeft = layoutRoot.scrollLeft;
	const maxScroll = layoutRoot.scrollWidth - layoutRoot.clientWidth;

	if (maxScroll <= 0) return;

	const midpoint = maxScroll / 2;
	const targetScroll = scrollLeft < midpoint ? 0 : maxScroll;

	if (Math.abs(scrollLeft - targetScroll) > 1) {
		smoothScrollTo(layoutRoot, targetScroll);
	}
};

const useRootScroll = () => {
	const scrollToStart = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			smoothScrollTo(layoutRoot, 0);
		}
	};

	const scrollToEnd = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			smoothScrollTo(layoutRoot, layoutRoot.scrollWidth - layoutRoot.clientWidth);
		}
	};

	/** Listens for scroll-end to enforce snapping. Falls back to debounced scroll for older browsers. */
	const setupSnapEnforcement = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (!layoutRoot) return;

		if ('onscrollend' in window) {
			layoutRoot.addEventListener('scrollend', enforceSnap);
			cleanupFn = () => layoutRoot.removeEventListener('scrollend', enforceSnap);
		} else {
			const debouncedEnforceSnap = () => {
				clearTimeout(scrollEndTimeout);
				scrollEndTimeout = setTimeout(enforceSnap, 150);
			};
			layoutRoot.addEventListener('scroll', debouncedEnforceSnap);
			cleanupFn = () => {
				layoutRoot.removeEventListener('scroll', debouncedEnforceSnap);
				clearTimeout(scrollEndTimeout);
			};
		}
	};

	const cleanupSnapEnforcement = () => {
		cleanupFn?.();
		cleanupFn = null;
	};

	return {
		scrollToStart,
		scrollToEnd,
		setupSnapEnforcement,
		cleanupSnapEnforcement,
	};
};

export default useRootScroll;
