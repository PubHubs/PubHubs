/**
 * Scrolls to the start or end of the layout root.
 */
const useRootScroll = () => {
	/**
	 * Scrolls to the start of the layout root.
	 */
	const scrollToStart = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			layoutRoot.scrollTo({ left: 0, behavior: 'smooth' });
		}
	};

	/**
	 * Scrolls to the end of the layout root.
	 */
	const scrollToEnd = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			layoutRoot.scrollTo({ left: layoutRoot.scrollWidth, behavior: 'smooth' });
		}
	};

	return {
		scrollToStart,
		scrollToEnd,
	};
};

export default useRootScroll;
