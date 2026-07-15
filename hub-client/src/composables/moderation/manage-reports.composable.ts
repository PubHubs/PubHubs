import { computed, ref } from 'vue';

import { APIService } from '@hub-client/logic/core/apiService';
import { createLogger } from '@hub-client/logic/logging/Logger';

import { type TEventReport } from '@hub-client/models/events/TEventReport';

import { useUser } from '@hub-client/stores/user';

const logger = createLogger('useReports');
const BATCH_SIZE = 100;

function useModerationManageReports() {
	// Stores
	const user = useUser();

	// Refs
	const reports = ref<TEventReport[]>([]);
	const totalReports = ref(0);
	const selectedReportId = ref<number>();
	const selectedReport = ref<TEventReport>();
	const isLoading = ref(false);

	// Computed
	const isAdmin = computed(() => user.isAdministrator);
	const hasMoreReports = computed(() => reports.value.length < totalReports.value);
	const oldestReportTimestamp = computed(() => {
		if (reports.value.length === 0) return null;
		// Reports are sorted by received_ts descending, so the last one is oldest
		return reports.value[reports.value.length - 1].received_ts;
	});

	// Functions
	const fetchReports = async () => {
		if (isLoading.value) return;
		isLoading.value = true;
		try {
			const response = await APIService.fetchReports(isAdmin.value, 0, BATCH_SIZE);
			reports.value = response.event_reports;
			totalReports.value = response.total;
		} catch (error) {
			logger.error('Failed to fetch reports:', error);
		} finally {
			isLoading.value = false;
		}
	};

	const loadMoreReports = async () => {
		if (isLoading.value || !hasMoreReports.value) return;
		isLoading.value = true;
		try {
			const response = await APIService.fetchReports(isAdmin.value, reports.value.length, BATCH_SIZE);
			reports.value = [...reports.value, ...response.event_reports];
			totalReports.value = response.total;
		} catch (error) {
			logger.error('Failed to load more reports:', error);
		} finally {
			isLoading.value = false;
		}
	};

	const deleteReport = async (reportId: number) => {
		try {
			await APIService.deleteReport(reportId);
			reports.value = reports.value.filter((r) => r.id !== reportId);
			totalReports.value = Math.max(0, totalReports.value - 1);
			if (selectedReportId.value === reportId) {
				clearSelection();
			}
		} catch (error) {
			logger.error('Failed to delete report:', error);
		}
	};

	const selectReport = (report: TEventReport) => {
		selectedReportId.value = report.id;
		selectedReport.value = report;
	};

	const clearSelection = () => {
		selectedReportId.value = undefined;
		selectedReport.value = undefined;
	};

	return {
		// State
		reports,
		totalReports,
		selectedReportId,
		selectedReport,
		isLoading,
		// Computed
		isAdmin,
		hasMoreReports,
		oldestReportTimestamp,
		// Functions
		fetchReports,
		loadMoreReports,
		deleteReport,
		selectReport,
		clearSelection,
	};
}

export { useModerationManageReports };
