import { TimeFormat, useSettings } from '@/store/settings';
import { useI18n } from 'vue-i18n';

const useTimeFormat = () => {
	function formatDate(date: Date, format: TimeFormat | undefined) {
		const settings = useSettings();
		if (typeof format === 'undefined') {
			format = settings.getTimeFormat as TimeFormat;
		}
		// We don't use Date.localeTimeString, it is slower.
		const hours24 = date.getHours();
		let hours = hours24;
		let pm = false;
		if (format === TimeFormat.format12) {
			hours = hours24 % 12;
			pm = hours24 >= 12;
			if (hours24 === 12) hours = 12;
		}
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const timeString = hours + ':' + minutes + (format === TimeFormat.format12 ? (pm ? ' PM' : ' AM') : '');
		return timeString;
	}

	function formatTimestamp(timestamp: number, format: TimeFormat | undefined) {
		const date = new Date(timestamp);
		return formatDate(date, format);
	}

	// Gets the date and time for an event based on its actual occurrence in time.
	// e.g., is the event happened today, yesterday or few days before or on a date.
	// This is useful for displaying when the message was written on the room.
	function formattedTimeInformation(timeStamp: number): string {
		const { t, d } = useI18n();
		const date = new Date(timeStamp);
		const today = new Date();

		const daysDiff = today.getDate() - date.getDate();

		const monthsDiff = today.getMonth() - date.getMonth();
		const yearsDiff = today.getFullYear() - date.getFullYear();
		if (yearsDiff === 0 && daysDiff === 0 && monthsDiff === 0) {
			return t('time.today');
		} else if (yearsDiff === 0 && monthsDiff === 0 && daysDiff === 1) {
			return t('time.yesterday');
		} else if (yearsDiff === 0 && monthsDiff === 0 && daysDiff > 1 && daysDiff < 3) {
			return t('time.daysago', [daysDiff]);
		}

		return d(date, 'short');
	}

	return { formatDate, formatTimestamp, formattedTimeInformation };
};

export { useTimeFormat };
