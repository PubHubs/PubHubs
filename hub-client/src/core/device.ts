export default {
	isTouchDevice() {
		return window.matchMedia('(hover: none)').matches;
	},
};
