// Packages
import { type MatrixClient } from 'matrix-js-sdk';
import { computed } from 'vue';

// Services
import { type SyncProfile } from '@hub-client/logic/matrix.logic';

import { initMatrixService } from '@hub-client/services/matrix.service';

// Stores
import { useMatrixStore } from '@hub-client/stores/matrix.store';

const useMatrix = () => {
	const store = useMatrixStore();

	// #region Getters / Setters

	const hasActiveSync = computed(() => store.hasActiveSync);
	const subscribedRooms = computed(() => store.subscribedRooms);

	// #endregion

	// #region Sliding Sync

	const startSync = (profile?: SyncProfile) => store.startSync(profile);
	const stopSync = () => store.stopSync();
	const addRoomSubscription = (roomId: string) => store.addRoomSubscription(roomId);

	const init = async (client: MatrixClient) => {
		initMatrixService(client);

		// await store.init(); // TODO: Load persisted matrix store data such as subscribedRooms
	};

	// #endregion

	return {
		// State
		hasActiveSync,
		subscribedRooms,

		// Sliding Sync
		startSync,
		stopSync,
		addRoomSubscription,
		init,
	};
};

// Exports
export { useMatrix };
