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
		} else {
			console.error('Element with ID "layout-root" not found.');
		}
	};

	/**
	 * Scrolls to the end of the layout root.
	 */
	const scrollToEnd = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			console.log('scrollToEnd');
			layoutRoot.scrollTo({ left: layoutRoot.scrollWidth, behavior: 'smooth' });
		} else {
			console.error('Element with ID "layout-root" not found.');
		}
	};

	return {
		scrollToStart,
		scrollToEnd,
	};
};

export default useRootScroll;
