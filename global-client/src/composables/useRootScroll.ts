/**
 * Layout root scroll helpers.
 * Navigation between nav and room views is always programmatic via scrollLeft.
 * overflow-x: hidden on layout-root prevents user touch-scroll (iOS).
 */
const SCROLL_DURATION = 150;
let isProgrammaticScroll = false;
let animationFrameId: number | null = null;

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

	return {
		scrollToStart,
		scrollToEnd,
	};
};

export default useRootScroll;
