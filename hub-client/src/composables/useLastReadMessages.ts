export const useLastReadMessages = () => {
	const STORAGE_KEY = 'lastReadMessages';

	const getLastReadMessage = (roomId: string): string | null => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) return null;

			const messages = JSON.parse(stored);
			return messages[roomId]?.eventId || null;
		} catch {
			return null;
		}
	};

	const setLastReadMessage = (roomId: string, eventId: string, timestamp: number): void => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			const messages = stored ? JSON.parse(stored) : {};
			const existingData = messages[roomId];

			// Only update if this message is newer than the existing one
			if (existingData && typeof existingData === 'object' && existingData.timestamp >= timestamp) {
				return;
			}

			messages[roomId] = { eventId, timestamp };
			localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
		} catch {
			// Silently fail - localStorage might be unavailable
		}
	};

	return { getLastReadMessage, setLastReadMessage };
};
