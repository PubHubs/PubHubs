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

			// TODO: Load persisted data from local storage
			// try {
			// 	// Load persisted subscriptions from account data
			// 	const persisted = await matrixService.loadSubscribedRoomsFromAccountData();
			// 	this.subscribedRooms = persisted ?? {};
			// } catch (err) {
			// 	console.warn('Failed to load subscribedRooms from MatrixService', err);
			// 	this.subscribedRooms = {};
			// }
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

		/**
		 * Use a subscription to sync a room using the Sliding Sync.
		 */
		// async syncRoom(roomId: string) {
		// 	const matrixService = useMatrixService();

		// 	return matrixService.syncRoom(roomId);
		// },
		async syncRooms() {
			const matrixService = useMatrixService();

			return matrixService.syncRooms();
		},

		addSubscribedRoom(roomId: string, timelineKey: string) {
			this.subscribedRooms[roomId] = timelineKey;
		},

		removeSubscribedRoom(roomId: string) {
			delete this.subscribedRooms[roomId];
		},

		// getTimelineKey(roomId: string): string | undefined {
		// 	return this.subscribedRooms[roomId];
		// },

		// getSubscribedRoomIds(): string[] {
		// 	return Object.keys(this.subscribedRooms);
		// },

		// clearSubscribedRooms() {
		// 	this.subscribedRooms = {};
		// },

		// #endregion
	},
});

// Exports
export { useMatrixStore };
