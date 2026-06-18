<template>
	<div class="relative flex h-full flex-col overflow-y-hidden py-200">
		<SidebarHeader :title="t('admin.report_details')" />
		<div
			v-if="report"
			class="flex flex-1 flex-col gap-300 overflow-y-auto px-200 pb-800"
		>
			<!-- Message preview -->
			<CollapsibleHeader
				:label="t('admin.reported_message')"
				:collapsible="false"
			>
				<ReportedMessagePreview
					:event-id="report.event_id"
					:room-id="report.room_id"
				/>
			</CollapsibleHeader>

			<!-- Room -->
			<CollapsibleHeader
				:label="t('admin.report_room')"
				:collapsible="false"
			>
				<p>{{ report.name || report.room_id }}</p>
				<p
					v-if="report.canonical_alias"
					class="text-on-surface-dim text-sm"
				>
					{{ report.canonical_alias }}
				</p>
			</CollapsibleHeader>

			<!-- Reported user -->
			<CollapsibleHeader
				:label="t('admin.report_sender')"
				:collapsible="false"
			>
				<UserLink :user-id="report.sender" />
			</CollapsibleHeader>

			<!-- Reporter -->
			<CollapsibleHeader
				:label="t('admin.report_reporter')"
				:collapsible="false"
			>
				<UserLink :user-id="report.user_id" />
			</CollapsibleHeader>

			<!-- Reason -->
			<CollapsibleHeader
				:label="t('admin.report_reason')"
				:collapsible="false"
			>
				<p class="italic">{{ report.reason || t('admin.no_reason') }}</p>
			</CollapsibleHeader>

			<!-- Time -->
			<CollapsibleHeader
				:label="t('admin.report_time')"
				:collapsible="false"
			>
				<p>{{ formattedTime }}</p>
			</CollapsibleHeader>
		</div>
		<div
			v-else
			class="flex h-full items-center justify-center px-200"
		>
			<p class="text-on-surface-dim text-center italic">
				{{ t('admin.select_report_placeholder') }}
			</p>
		</div>

		<!-- FABs -->
		<div
			v-if="report"
			class="absolute right-150 bottom-150 flex gap-100"
		>
			<FloatingActionButton
				:label="t('admin.go_to_message')"
				icon="arrow-right"
				@click="emit('goToMessage')"
			/>
			<FloatingActionButton
				v-if="isAdmin"
				:label="t('admin.delete_report')"
				color="error"
				icon="trash"
				@click="emit('delete')"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type PropType, computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import ReportedMessagePreview from '@hub-client/components/ui/ReportedMessagePreview.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';
	import UserLink from '@hub-client/components/ui/UserLink.vue';

	// Models
	import { type TEventReport } from '@hub-client/models/events/TEventReport';

	// Props
	const props = defineProps({
		isAdmin: { type: Boolean, default: false },
		report: { type: Object as PropType<TEventReport | undefined>, default: undefined },
	});

	const emit = defineEmits<{
		delete: [];
		goToMessage: [];
	}>();

	const { t } = useI18n();

	const formattedTime = computed(() => {
		if (!props.report) return '';
		const date = new Date(props.report.received_ts);
		return date.toLocaleString();
	});
</script>
