/**
 * Scrolls to the start or end of the layout root.
 * Also provides snap enforcement for Safari compatibility.
 */
const useRootScroll = () => {
	const SCROLL_DURATION = 150; // ms

	let isProgrammaticScroll = false;

	/**
	 * Custom smooth scroll with configurable duration using easeOutCubic.
	 */
	const smoothScrollTo = (element: HTMLElement, targetLeft: number) => {
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
				requestAnimationFrame(animateScroll);
			} else {
				isProgrammaticScroll = false;
			}
		};

		requestAnimationFrame(animateScroll);
	};

	/**
	 * Scrolls to the start of the layout root.
	 */
	const scrollToStart = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			smoothScrollTo(layoutRoot, 0);
		}
	};

	/**
	 * Scrolls to the end of the layout root.
	 */
	const scrollToEnd = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			smoothScrollTo(layoutRoot, layoutRoot.scrollWidth - layoutRoot.clientWidth);
		}
	};

	/**
	 * Enforces scroll-snap by programmatically snapping to the nearest snap point
	 * after scrolling ends. This is a safety net for Safari, which sometimes fails
	 * to enforce CSS scroll-snap-type: mandatory.
	 */
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

	let scrollEndTimeout: ReturnType<typeof setTimeout>;
	let cleanupFn: (() => void) | null = null;

	/**
	 * Sets up a scroll-end listener that enforces snapping.
	 * Uses the `scrollend` event where supported (Safari 18+, Chrome 114+),
	 * falls back to a debounced `scroll` listener for older browsers.
	 */
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
