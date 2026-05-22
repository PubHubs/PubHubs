import { MatrixEvent, type Room as MatrixRoom } from 'matrix-js-sdk';
import { ref } from 'vue';

import { api_synapse } from '@hub-client/logic/core/api';
import { ApiError } from '@hub-client/logic/core/apiCore';
import { createLogger } from '@hub-client/logic/logging/Logger';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

export class LibraryMatrixEvent extends MatrixEvent {
	public signed: boolean | undefined;
	public signedEvents: Array<MatrixEvent> | undefined;
}

const useRoomLibrary = () => {
	const logger = createLogger('RoomLibrary');
	const elFileInput = ref<HTMLInputElement | null>(null);
	const fileObject = ref<File>({} as File);
	const uri = ref('');
	const pubhubsStore = usePubhubsStore();
	const roomsStore = useRooms();

	async function makeHash(accessToken: string | null, url: string, room: MatrixRoom): Promise<string> {
		const roomName = room.name || 'unknown'; //default to unknwon if roomname not specified
		const roomContext = ` This is a pubhubs library for room ${roomName}`;
		const finalContext = roomContext.length + roomContext;
		// Similar to fileDownload.ts but we need the blob
		const options = {
			headers: {
				Authorization: 'Bearer ' + accessToken,
			},
			method: 'GET',
		};
		try {
			const response = await fetch(url, options);
			const blob = await response.blob();
			//Hash the file
			const fileArrayBuffer = await blob.arrayBuffer();
			const fileHashBuffer = await window.crypto.subtle.digest('SHA-256', fileArrayBuffer); // from https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
			const fileHashArray = new Uint8Array(fileHashBuffer); // Convert buffer to byte array

			//Hash the context
			const contextUint8 = new TextEncoder().encode(finalContext);
			const contextHashBuffer = await window.crypto.subtle.digest('SHA-256', contextUint8);
			const contextHashArray = new Uint8Array(contextHashBuffer);

			//Combine both hashes by appending
			const combined = new Uint8Array([...contextHashArray, ...fileHashArray]);
			const combinedHashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
			const combinedHashArray = Array.from(new Uint8Array(combinedHashBuffer));

			const combinedHashHex = combinedHashArray.map((byte) => byte.toString(16).padStart(2, '0')).join(''); // Convert bytes to hex

			return combinedHashHex;
		} catch (error) {
			logger.error(error);
			return '';
		}
	}

	async function deleteMedia(url: string, eventId: string, roomId: string, retryCount = 0): Promise<void> {
		const maxRetries = 3;
		try {
			await api_synapse.apiDELETE(url);
		} catch (error) {
			// Check for rate limiting (429)
			if (error instanceof ApiError && (error.status === 429 || error.errcode === 'M_LIMIT_EXCEEDED')) {
				if (retryCount < maxRetries) {
					const waitTime = error.retry_after_ms ?? 5000;
					logger.warn(`Rate limited, waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
					await new Promise((resolve) => setTimeout(resolve, waitTime));
					return deleteMedia(url, eventId, roomId, retryCount + 1);
				}
				logger.error('Max retries exceeded for rate limiting');
				return;
			}

			// Check for 404/not found errors
			if (error instanceof ApiError && (error.status === 404 || error.errcode === 'M_NOT_FOUND')) {
				logger.warn('Media file already deleted, proceeding to redact event: ' + eventId);
			} else {
				logger.error('Unable to delete the media file ' + error);
				return;
			}
		}
		await pubhubsStore.deleteMessage(roomId, eventId);
	}

	async function removeFromTimeline(eventId: string, roomId: string, signedEvents: Array<MatrixEvent>) {
		try {
			await pubhubsStore.deleteLibraryMessage(roomId, eventId);
			// Remove all the related child events (signed banners) from the timeline
			for (const relatedEvent of signedEvents) {
				if (relatedEvent.event.event_id) {
					await pubhubsStore.deleteLibraryMessage(roomId, relatedEvent.event.event_id);
				}
			}
		} catch (error) {
			logger.error('Unable to update the roomlibrary timeline ' + error);
		}
		// Remove from local library events immediately for reactivity
		const room = roomsStore.rooms[roomId];
		if (room) {
			room.removeLibraryEvent(eventId);
			for (const relatedEvent of signedEvents) {
				if (relatedEvent.event.event_id) {
					room.removeLibraryEvent(relatedEvent.event.event_id);
				}
			}
		}
	}

	// #endregion

	return { makeHash, deleteMedia, removeFromTimeline, elFileInput, fileObject, uri };
};

export { useRoomLibrary };
