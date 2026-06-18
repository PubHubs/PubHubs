<template>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<div
			class="border-on-surface-disabled flex h-1000 shrink-0 items-center justify-between border-b px-400"
			:class="isMobile ? 'pl-600' : 'pl-400'"
		>
			<div class="flex w-fit items-center gap-150 overflow-hidden">
				<Icon type="warning" />
				<H3 class="font-headings text-h3 text-on-surface font-semibold">
					{{ t('menu.reports') }}
				</H3>
			</div>
		</div>

		<div class="flex flex-1 overflow-hidden">
			<div
				id="reports-container"
				ref="reportsContainer"
				class="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
				:class="isMobile ? 'py-150' : 'py-200'"
			>
				<div
					class="flex flex-col gap-y-200 pb-200"
					:class="isMobile ? 'px-150' : 'px-200'"
				>
					<!-- Search and load more -->
					<div
						class="flex gap-200"
						:class="isMobile ? 'flex-col' : 'items-center justify-between'"
					>
						<TextField
							v-model="searchQuery"
							class="flex-1"
							icon="magnifying-glass"
							type="search"
							:placeholder="$t('admin.filter_reports')"
						/>
						<div
							v-if="hasMoreReports"
							class="flex shrink-0 items-center gap-150"
						>
							<span
								v-if="!isMobile"
								class="text-on-surface-dim text-sm whitespace-nowrap"
							>
								{{ t('admin.reports_since', [oldestReportDate]) }}
							</span>
							<Button
								variant="secondary"
								size="sm"
								icon="clock"
								:disabled="isLoading"
								@click="loadMoreReports"
							>
								{{ isMobile ? t('admin.reports_since', [oldestReportDate]) : t('admin.load_older') }}
							</Button>
						</div>
					</div>
				</div>

				<!-- Reports table -->
				<div
					class="flex flex-col gap-200"
					:class="isMobile ? 'px-150' : 'grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-x-0 gap-y-0'"
				>
					<div
						v-if="!isMobile"
						class="contents"
					>
						<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
							{{ t('admin.report_room') }}
						</div>
						<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
							{{ t('admin.report_sender') }}
						</div>
						<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
							{{ t('admin.report_reporter') }}
						</div>
						<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
							{{ t('admin.report_reason') }}
						</div>
						<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
							{{ t('admin.report_time') }}
						</div>
					</div>
					<TableRow
						v-for="(report, index) in paginatedReports"
						:key="report.id"
						:odd="index % 2 === 0"
						:selected="selectedReportId === report.id"
						@click="handleSelectReport(report)"
					>
						<ReportListCard :report="report" />
					</TableRow>
				</div>

				<!-- Pagination -->
				<div
					v-if="totalPages > 1"
					class="flex items-center gap-200 py-200"
					:class="isMobile ? 'justify-start px-150' : 'justify-center px-200'"
				>
					<Button
						variant="secondary"
						size="sm"
						icon="caret-left"
						:disabled="currentPage === 1"
						@click="prevPage"
					/>
					<p class="text-on-surface-dim text-sm">
						{{ t('others.page_x_of_y', [currentPage, totalPages]) }}
					</p>
					<Button
						variant="secondary"
						size="sm"
						icon="caret-right"
						:disabled="currentPage === totalPages"
						@click="nextPage"
					/>
				</div>

				<!-- Empty state -->
				<div
					v-if="filteredReports.length === 0"
					class="flex h-800 items-center justify-center"
				>
					<p class="text-on-surface-dim px-200 text-center">{{ $t('admin.empty_reports') }}</p>
				</div>
			</div>

			<RoomSidebar
				:active-tab="sidebar.activeTab.value"
				:is-mobile="isMobile"
			>
				<!-- Report details view -->
				<ManageReportSidebar
					v-if="selectedReport"
					:report="selectedReport"
					:is-admin="isAdmin"
					@delete="deleteSelectedReport"
					@go-to-message="goToMessage"
				/>

				<!-- Placeholder -->
				<div
					v-else
					class="flex h-full flex-col py-200"
				>
					<SidebarHeader :title="t('admin.report_details')" />
					<div class="flex h-full items-center justify-center px-200">
						<p class="text-on-surface-dim text-center italic">
							{{ t('admin.select_report_placeholder') }}
						</p>
					</div>
				</div>
			</RoomSidebar>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave, useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import ReportListCard from '@hub-client/components/rooms/ReportListCard.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import TableRow from '@hub-client/components/rooms/TableRow.vue';
	import ManageReportSidebar from '@hub-client/components/ui/ManageReportSidebar.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useModerationManageReports } from '@hub-client/composables/moderation/manage-reports.composable';
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { type TEventReport } from '@hub-client/models/events/TEventReport';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const logger = createLogger('ManageReports');
	const { t } = useI18n();
	const router = useRouter();
	const settings = useSettings();
	const sidebar = useSidebar();
	const userStore = useUser();

	const isMobile = computed(() => settings.isMobileState);

	// Pagination constants and refs
	const ROW_HEIGHT = 68;
	const SEARCH_H = 140;
	const PAGINATION_H = 44;
	const HEADER_ROW_H = 33;

	const reportsContainer = ref<HTMLElement | null>(null);
	const fillContainerHeight = ref(0);
	const currentPage = ref(1);
	let resizeObserver: ResizeObserver | null = null;

	const {
		reports,
		selectedReportId,
		selectedReport,
		isLoading,
		isAdmin,
		hasMoreReports,
		oldestReportTimestamp,
		fetchReports,
		loadMoreReports,
		deleteReport,
		selectReport,
		clearSelection,
	} = useModerationManageReports();

	const searchQuery = ref('');

	const oldestReportDate = computed(() => {
		if (!oldestReportTimestamp.value) return '';
		return new Date(oldestReportTimestamp.value).toLocaleDateString();
	});

	// Filter reports by search query
	const filteredReports = computed(() => {
		const query = searchQuery.value.toLowerCase().trim();
		if (!query) return reports.value;

		return reports.value.filter((report) => {
			return (
				report.name?.toLowerCase().includes(query) ||
				report.room_id.toLowerCase().includes(query) ||
				report.sender.toLowerCase().includes(query) ||
				report.user_id.toLowerCase().includes(query) ||
				report.reason?.toLowerCase().includes(query) ||
				userStore.userDisplayName(report.sender)?.toLowerCase().includes(query) ||
				userStore.userDisplayName(report.user_id)?.toLowerCase().includes(query)
			);
		});
	});

	// Pagination computed properties
	const fillPageSize = computed(() => {
		if (isMobile.value) return 10;
		const available = fillContainerHeight.value - SEARCH_H - PAGINATION_H - HEADER_ROW_H;
		if (available <= 0) return 10;
		return Math.max(5, Math.floor(available / ROW_HEIGHT));
	});

	const totalPages = computed(() => Math.max(1, Math.ceil(filteredReports.value.length / fillPageSize.value)));

	const paginatedReports = computed(() => {
		const start = (currentPage.value - 1) * fillPageSize.value;
		return filteredReports.value.slice(start, start + fillPageSize.value);
	});

	watch(
		() => sidebar.activeTab.value,
		(tab) => {
			if (tab === SidebarTab.None) {
				clearSelection();
			}
		},
	);

	// Reset page when search changes
	watch(searchQuery, () => {
		currentPage.value = 1;
	});

	const handleSelectReport = (report: TEventReport) => {
		if (sidebar.activeTab.value === SidebarTab.ManageReport && selectedReportId.value === report.id) {
			sidebar.close();
			return;
		}
		selectReport(report);
		sidebar.openTab(SidebarTab.ManageReport);
	};

	const prevPage = () => {
		if (currentPage.value > 1) currentPage.value--;
	};

	const nextPage = () => {
		if (currentPage.value < totalPages.value) currentPage.value++;
	};

	const deleteSelectedReport = async () => {
		if (!selectedReportId.value) return;
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.delete_report_confirm'))) {
			await deleteReport(selectedReportId.value);
			sidebar.close();
		}
	};

	const goToMessage = () => {
		if (!selectedReport.value) return;
		router
			.push({
				name: 'room',
				params: { id: selectedReport.value.room_id },
				query: { eventId: selectedReport.value.event_id },
			})
			.catch((err) => {
				logger.error('Failed to navigate to message:', err);
			});
	};

	onMounted(async () => {
		await fetchReports();

		// Set up ResizeObserver for pagination
		const el = reportsContainer.value;
		if (el) {
			fillContainerHeight.value = el.clientHeight;
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					fillContainerHeight.value = entry.contentRect.height;
				}
			});
			resizeObserver.observe(el);
		}
	});

	onUnmounted(() => {
		resizeObserver?.disconnect();
	});

	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});
</script>
