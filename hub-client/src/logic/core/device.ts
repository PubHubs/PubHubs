export default {
	isTouchDevice() {
		return window.matchMedia('(hover: none)').matches;
	},

	getMobileOS() {
		const userAgent = navigator.userAgent;
		if (/android/i.test(userAgent)) {
			return 'Android';
		} else if (/iPad|iPhone|iPod/.test(userAgent)) {
			return 'iOS';
		}
		return 'Unknown';
	},

	getBrowserName() {
		const userAgent = navigator.userAgent;

		if (userAgent.includes('Firefox')) {
			return 'Firefox';
		} else if (userAgent.includes('SamsungBrowser')) {
			return 'Samsung Browser';
		} else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
			return 'Opera';
		} else if (userAgent.includes('Edge') || userAgent.includes('Edg')) {
			return 'Edge';
		} else if (userAgent.includes('Chrome')) {
			return 'Chrome';
		} else if (userAgent.includes('Safari')) {
			return 'Safari';
		}
		return 'Unknown';
	},

	isRunningStandalone() {
		const iosStandalone: boolean = 'standalone' in navigator && (navigator as any).standalone;
		return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
	},
};
