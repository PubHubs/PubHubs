/**
 * Scrolls to the start or end of the layout root.
 */
const useRootScroll = () => {
	const SCROLL_DURATION = 150; // ms

	/**
	 * Custom smooth scroll with configurable duration using easeOutCubic.
	 */
	const smoothScrollTo = (element: HTMLElement, targetLeft: number) => {
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
			smoothScrollTo(layoutRoot, layoutRoot.scrollWidth);
		}
	};

	return {
		scrollToStart,
		scrollToEnd,
	};
};

export default useRootScroll;
