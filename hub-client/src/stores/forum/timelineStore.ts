import { Filter, MatrixClient, TimelineWindow } from 'matrix-js-sdk';
import { Room as MatrixRoom } from 'matrix-js-sdk/lib/models/room';
import { defineStore } from 'pinia';

import Room from '@hub-client/models/rooms/Room';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

export const useTimelineStore = defineStore('timelineStore', {
	state: () => ({
		client: usePubhubsStore().client as MatrixClient,
		room: undefined as Room | undefined,
		matrixRoom: null as MatrixRoom | null,
		tw: null as TimelineWindow | null,
	}),
	actions: {
		initRoom() {
			this.room = useRooms().currentRoom;
			if (!this.room) {
				throw new Error('No room found');
			}
			this.matrixRoom = this.client.getRoom(this.room.roomId);
			if (!this.matrixRoom) {
				throw new Error('No room found');
			}
		},
		createFilteredTimelineWindow(filterDefinition: any) {
			if (!filterDefinition || !this.matrixRoom) return;
			for (const set of this.matrixRoom.getTimelineSets()) {
				const oldFilter = set.getFilter();
				if (oldFilter) {
					this.matrixRoom.removeFilteredTimelineSet(oldFilter);
				}
			}
			const filter = new Filter(undefined);
			filter.setDefinition(filterDefinition);
			const filteredSet = this.matrixRoom.getOrCreateFilteredTimelineSet(filter);
			this.tw = new TimelineWindow(this.client as MatrixClient, filteredSet);
		},
	},
});
