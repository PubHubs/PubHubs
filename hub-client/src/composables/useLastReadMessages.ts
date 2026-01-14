export const useLastReadMessages = () => {
	const STORAGE_KEY = 'lastReadMessages';

	const getLastReadMessage = (roomId: string): string | null => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) {
				console.warn('[LastReadMessages] getLastReadMessage: no stored data', { roomId });
				return null;
			}
			const messages = JSON.parse(stored);
			const data = messages[roomId];
			console.warn('[LastReadMessages] getLastReadMessage:', { roomId, data });
			return data?.eventId || null;
		} catch (error) {
			console.error('Failed to get last read message:', error);
			return null;
		}
	};

	const setLastReadMessage = (roomId: string, eventId: string, timestamp: number): void => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			const messages = stored ? JSON.parse(stored) : {};
			const existingData = messages[roomId];

			console.warn('[LastReadMessages] setLastReadMessage: attempt', { roomId, eventId, timestamp, existingData });

			// Only update if this message is newer than the existing one
			if (existingData && typeof existingData === 'object' && existingData.timestamp >= timestamp) {
				console.warn('[LastReadMessages] setLastReadMessage: skipped (existing is newer)', { existingTimestamp: existingData.timestamp, newTimestamp: timestamp });
				return;
			}

			messages[roomId] = { eventId, timestamp };
			localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
			console.warn('[LastReadMessages] setLastReadMessage: saved', { roomId, eventId, timestamp });
		} catch (error) {
			console.error('Failed to set last read message:', error);
		}
	};

	return { getLastReadMessage, setLastReadMessage };
};
