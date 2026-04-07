/**
 * Composable for clipboard operations and URL sharing
 */
import { getHubUrl, getRoomUrl } from '@hub-client/logic/core/urls';
import { createLogger } from '@hub-client/logic/logging/Logger';

import { useHubSettings } from '@hub-client/stores/hub-settings';
import { useRooms } from '@hub-client/stores/rooms';

/**
 * Composable for clipboard operations
 * Handles copying hub and room URLs to clipboard
 * Automatically uses hub settings from the store
 */
export function useClipboard() {
	const logger = createLogger('Clipboard');
	const hubSettings = useHubSettings();
	const rooms = useRooms();

	/**
	 * Copies the current hub URL to clipboard
	 * @returns Promise that resolves when URL is copied
	 */
	async function copyHubUrl(): Promise<void> {
		try {
			const fullUrl = getHubUrl(hubSettings.hubName ?? '', hubSettings.parentUrl);
			await navigator.clipboard.writeText(fullUrl);
			logger.info('Hub URL copied to clipboard:', fullUrl);
		} catch (err) {
			logger.error('Failed to copy hub URL:', err);
			throw err;
		}
	}

	/**
	 * Copies a room URL to clipboard
	 * @param roomId - The Matrix room ID
	 * @returns Promise that resolves when URL is copied
	 */
	async function copyRoomUrl(roomId: string): Promise<void> {
		try {
			const fullUrl = getRoomUrl(roomId, hubSettings.hubName ?? '', hubSettings.parentUrl);
			await navigator.clipboard.writeText(fullUrl);
			logger.info('Room URL copied to clipboard:', fullUrl);
		} catch (err) {
			logger.error('Failed to copy room URL:', err);
			throw err;
		}
	}

	/**
	 * Copies the current room URL to clipboard
	 * Uses the current room from the rooms store
	 * @returns Promise that resolves when URL is copied
	 */
	async function copyCurrentRoomUrl(): Promise<void> {
		if (!rooms.currentRoom) {
			logger.error('No current room to copy URL for');
			throw new Error('No current room');
		}
		await copyRoomUrl(rooms.currentRoom.roomId);
	}

	return {
		copyHubUrl,
		copyRoomUrl,
		copyCurrentRoomUrl,
	};
}
