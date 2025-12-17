// Packages
import { defineStore } from 'pinia';

// Services
import { useMatrixService } from '@hub-client/services/matrix.service';

const useMatrixStore = defineStore('matrix', {
	state: () => ({
		hasActiveSync: false,
		subscribedRooms: {} as Record<string, string>,
	}),

	actions: {
		// #region Matrix

		async init() {
			const matrixService = useMatrixService();
			if (!matrixService) return;
		},

		// #endregion

		// #region Sliding Sync

		/**
		 * Start the Sliding Sync.
		 */
		async startSync() {
			if (this.hasActiveSync) return;

			try {
				const matrixService = useMatrixService();
				await matrixService.startSync();
			} finally {
				this.hasActiveSync = true;
			}
		},

		/**
		 * Stop the Sliding Sync.
		 */
		async stopSync() {
			try {
				const matrixService = useMatrixService();
				await matrixService.stopSync();
			} finally {
				this.hasActiveSync = false;
			}
		},

		/**
		 * Add a subscription to a room to the Sliding Sync.
		 */
		addRoomSubscription(roomId: string) {
			const matrixService = useMatrixService();

			return matrixService.addRoomSubscription(roomId);
		},

		addSubscribedRoom(roomId: string, timelineKey: string) {
			this.subscribedRooms[roomId] = timelineKey;
		},

		removeSubscribedRoom(roomId: string) {
			delete this.subscribedRooms[roomId];
		},

		// #endregion
	},
});

// Exports
export { useMatrixStore };
