// Packages
import { EventTimeline, EventType, Room as MatrixRoom } from 'matrix-js-sdk';

// Models
import { RoomType } from '@hub-client/models/rooms/TBaseRoom';

const getRoomType = (matrixRoom: MatrixRoom): string => {
	let roomType: string = RoomType.PH_MESSAGES_DEFAULT;

	try {
		const state = matrixRoom.getLiveTimeline().getState(EventTimeline.FORWARDS);
		const createEvt = state?.getStateEvents(EventType.RoomCreate, '') ?? null;
		if (createEvt?.getContent && createEvt.getContent()?.type) {
			roomType = createEvt.getContent().type ?? roomType;
		}
	} catch (_) {
		// Ignore for now
	}

	return roomType;
};

// Exports
export { getRoomType };
