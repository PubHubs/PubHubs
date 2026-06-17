<template>
	<!-- Mobile: card layout -->
	<div
		v-if="isMobile"
		class="rounded-base bg-surface-base flex flex-col gap-4 p-4"
		@click="$emit('click')"
	>
		<div class="flex flex-col gap-2">
			<p class="truncate font-semibold">
				{{ report.name || report.room_id }}
			</p>
			<div class="flex items-center gap-2">
				<span class="text-on-surface-dim w-20 shrink-0 text-sm">{{ t('admin.report_against') }}:</span>
				<UserBadge
					:user-id="report.sender"
					size="sm"
				/>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-on-surface-dim w-20 shrink-0 text-sm">{{ t('admin.report_from') }}:</span>
				<UserBadge
					:user-id="report.user_id"
					size="sm"
				/>
			</div>
			<p
				v-if="report.reason"
				class="text-sm italic"
			>
				"{{ truncatedReason }}"
			</p>
			<p class="text-on-surface-dim text-xs">
				{{ formattedTime }}
			</p>
		</div>
	</div>

	<!-- Desktop: grid cells -->
	<template v-else>
		<TableRowCell :title="report.name || report.room_id">
			<p class="truncate font-semibold">
				{{ report.name || report.room_id }}
			</p>
		</TableRowCell>

		<TableRowCell :title="report.sender">
			<UserBadge :user-id="report.sender" />
		</TableRowCell>

		<TableRowCell :title="report.user_id">
			<UserBadge :user-id="report.user_id" />
		</TableRowCell>

		<TableRowCell :title="report.reason || ''">
			<p class="truncate text-sm italic">
				{{ truncatedReason }}
			</p>
		</TableRowCell>

		<TableRowCell>
			<p class="text-on-surface-dim text-xs whitespace-nowrap">
				{{ formattedTime }}
			</p>
		</TableRowCell>
	</template>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import TableRowCell from '@hub-client/components/rooms/TableRowCell.vue';
	import UserBadge from '@hub-client/components/ui/UserBadge.vue';

	// Models
	import { type TEventReport } from '@hub-client/models/events/TEventReport';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	const props = defineProps<{
		report: TEventReport;
	}>();

	defineEmits<{
		click: [];
	}>();

	const { t } = useI18n();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	const truncatedReason = computed(() => {
		if (!props.report.reason) return '';
		return props.report.reason.length > 50 ? props.report.reason.substring(0, 50) + '...' : props.report.reason;
	});

	const formattedTime = computed(() => {
		const date = new Date(props.report.received_ts);
		return date.toLocaleString();
	});
</script>
