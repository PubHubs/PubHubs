/**
 * Utilities for constructing shareable URLs
 */

/**
 * Constructs the hub URL for sharing
 * @param hubName - The name of the hub
 * @param parentUrl - The parent application URL
 * @returns The full shareable hub URL
 */
export function getHubUrl(hubName: string, parentUrl: string): string {
	return `${parentUrl}#/hub/${encodeURIComponent(hubName)}/`;
}

/**
 * Constructs the room URL for sharing
 * @param roomId - The Matrix room ID
 * @param hubName - The name of the hub
 * @param parentUrl - The parent application URL
 * @returns The full shareable room URL (without access tokens)
 */
export function getRoomUrl(roomId: string, hubName: string, parentUrl: string): string {
	// Remove any access tokens or query parameters
	const cleanRoomId = roomId.split('?')[0];
	return `${parentUrl}#/hub/${encodeURIComponent(hubName)}/${encodeURIComponent(cleanRoomId)}`;
}
