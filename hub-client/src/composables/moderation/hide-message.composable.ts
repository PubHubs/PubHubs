import { reactive } from 'vue';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

function useModerationHideMessage() {
	// Stores
	const pubhubsStore = usePubhubsStore();

	// Reactive state
	const hideMessageDialog = reactive<{
		visible: boolean;
		roomId: string;
		eventId: string;
	}>({
		visible: false,
		roomId: '',
		eventId: '',
	});

	// Functions
	const hideMessage = (roomId: string, targetEventId: string, label: string) => pubhubsStore.addVisibilityMessage(roomId, targetEventId, true, label);

	const unHideMessage = (roomId: string, targetEventId: string) => pubhubsStore.addVisibilityMessage(roomId, targetEventId, false);

	const openHideMessageDialog = (roomId: string, eventId: string) => {
		hideMessageDialog.roomId = roomId;
		hideMessageDialog.eventId = eventId;
		hideMessageDialog.visible = true;
	};

	const onHideMessageDialogSubmit = (label: string) => {
		hideMessage(hideMessageDialog.roomId, hideMessageDialog.eventId, label);
	};

	return {
		// Reactive state
		hideMessageDialog,
		// Functions
		hideMessage,
		unHideMessage,
		openHideMessageDialog,
		onHideMessageDialogSubmit,
	};
}

export { useModerationHideMessage };
