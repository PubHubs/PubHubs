/**
 * Composable to send scroll actions to the parent window (global client).
 */
const useGlobalScroll = () => {
	/**
	 * Sends a message to the parent window to scroll to the end.
	 */
	const scrollToEnd = () => {
		window.parent.postMessage({ handleGlobalScroll: 'scrollToEnd' }, '*');
	};

	/**
	 * Sends a message to the parent window to scroll to the start.
	 */
	const scrollToStart = () => {
		window.parent.postMessage({ handleGlobalScroll: 'scrollToStart' }, '*');
	};

	return {
		scrollToEnd,
		scrollToStart,
	};
};

export default useGlobalScroll;
