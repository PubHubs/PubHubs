// Packages
import { EventTimelineSet, Filter, Room as MatrixRoom } from 'matrix-js-sdk';
import { ref } from 'vue';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';
import { PubHubsMgType } from '@hub-client/logic/core/events';

// Models
import Room from '@hub-client/models/rooms/Room';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

const FILTER_ID = 'RoomLibraryTimeline';

const useRoomLibrary = () => {
	const elFileInput = ref<HTMLInputElement | null>(null);
	const fileObject = ref<File>({} as File);
	const uri = ref('');
	const pubhubsStore = usePubhubsStore();
	const rooms = useRooms();

	const timelineSetFilter = {
		room: {
			timeline: {
				types: [PubHubsMgType.LibraryFileMessage],
			},
		},
	};

	// #region functions

	function loadRoomLibraryTimeline(room: MatrixRoom): EventTimelineSet {
		const filter = new Filter(undefined, FILTER_ID);
		filter.setDefinition(timelineSetFilter);

		const filteredTimelineSet = room.getOrCreateFilteredTimelineSet(filter);

		return filteredTimelineSet;
	}

	async function makeHash(accessToken: string | null, url: string, id: string): Promise<string> {
		const roomName = rooms.rooms[id].name || 'unknown'; //default to unknwon if roomname not specified
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
			console.error(error);
			return '';
		}
	}

	async function deleteMedia(url: string, eventId: string) {
		try {
			await api_synapse.apiDELETE<any>(url);
			await pubhubsStore.deleteMessage(rooms.currentRoomId, eventId); //Redact the event
		} catch (error) {
			console.error('Unable to delete the media file ' + error);
			return null;
		}
	}

	async function updateTimeline(eventId: string, room: Room, signedEvents: any) {
		try {
			const timeline = room.loadRoomlibrary().getLiveTimeline();
			timeline.removeEvent(eventId);
			// Remove all the related child events (singed banners) from the timeline
			for (const relatedEvent of signedEvents) {
				if (relatedEvent.event.event_id) {
					await pubhubsStore.deleteMessage(rooms.currentRoomId, relatedEvent.event.event_id); //Redact the child events
					timeline.removeEvent(relatedEvent.event.event_id);
				}
			}
			return timeline;
		} catch (error) {
			console.error('Unable to update the roomlibrary timeline ' + error);
			return null;
		}
	}

	// #endregion

	return { loadRoomLibraryTimeline, makeHash, deleteMedia, updateTimeline, elFileInput, fileObject, uri };
};

export { useRoomLibrary };
