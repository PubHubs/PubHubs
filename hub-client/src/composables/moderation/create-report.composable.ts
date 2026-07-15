import { reactive } from 'vue';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

function useModerationCreateReport() {
	// Stores
	const pubhubsStore = usePubhubsStore();

	// Reactive state
	const reportDialog = reactive<{
		visible: boolean;
		roomId: string;
		eventId: string;
	}>({
		visible: false,
		roomId: '',
		eventId: '',
	});

	// Functions
	/**
	 * Report an event to the server.
	 * @param roomId - The room containing the event
	 * @param eventId - The event to report
	 * @param score - A score from -100 (most offensive) to 0 (inoffensive)
	 * @param reason - The reason for reporting
	 */
	const reportEvent = (roomId: string, eventId: string, score: number, reason: string) => pubhubsStore.client.reportEvent(roomId, eventId, score, reason);

	const openReportDialog = (roomId: string, eventId: string) => {
		reportDialog.roomId = roomId;
		reportDialog.eventId = eventId;
		reportDialog.visible = true;
	};

	const closeReportDialog = () => {
		reportDialog.visible = false;
		reportDialog.roomId = '';
		reportDialog.eventId = '';
	};

	const onReportDialogSubmit = async (reason: string, score: number = -50) => {
		await reportEvent(reportDialog.roomId, reportDialog.eventId, score, reason);
		closeReportDialog();
	};

	return {
		// Reactive state
		reportDialog,
		// Functions
		reportEvent,
		openReportDialog,
		closeReportDialog,
		onReportDialogSubmit,
	};
}

export { useModerationCreateReport };
