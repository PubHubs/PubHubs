import { useSettings, TimeFormat } from '@/store/store';

const useTimeFormat = () => {
	function formatDate(date: Date, format: TimeFormat | undefined) {
		const settings = useSettings();
		if (typeof format == 'undefined') {
			format = settings.getTimeFormat as TimeFormat;
		}
		// We don't use Date.localeTimeString, it is slower.
		const hours24 = date.getHours();
		let hours = hours24;
		let pm = false;
		if (format == TimeFormat.format12) {
			hours = hours24 % 12;
			pm = hours24 >= 12;
			if (hours24 == 12) hours = 12;
		}
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const timeString = hours + ':' + minutes + (format == TimeFormat.format12 ? (pm ? ' PM' : ' AM') : '');
		return timeString;
	}

	function formatTimestamp(timestamp: number, format: TimeFormat | undefined) {
		const date = new Date(timestamp);
		return formatDate(date, format);
	}

	return { formatDate, formatTimestamp };
};

export { useTimeFormat };
