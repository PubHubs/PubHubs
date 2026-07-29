<template>
	<!-- Mobile: card layout -->
	<div
		v-if="isMobile"
		class="rounded-base bg-surface-base flex flex-col gap-200 p-200"
		:title="userId"
		@click="$emit('click')"
	>
		<div class="flex items-center gap-200">
			<Avatar
				:avatar-url="avatarUrl"
				:user-id="userId"
			/>
			<div class="gap-050 flex min-w-0 flex-1 flex-col">
				<p class="truncate font-semibold">
					{{ displayName }}
				</p>
				<p class="text-on-surface-dim truncate text-sm italic">
					{{ roomName }}
				</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-200 text-sm">
			<span
				class="py-050 rounded-full px-150"
				:class="typeClasses"
			>
				{{ typeLabel }}
			</span>
			<span
				v-if="status"
				class="py-050 rounded-full px-150"
				:class="statusClasses"
			>
				{{ statusLabel }}
			</span>
		</div>
	</div>

	<!-- Desktop: grid cells -->
	<template v-else>
		<TableRowCell
			class="flex min-w-0 items-center gap-100"
			:title="displayName"
		>
			<Avatar
				:avatar-url="avatarUrl"
				:user-id="userId"
				size="sm"
			/>
			<p class="truncate font-semibold">
				{{ displayName }}
			</p>
		</TableRowCell>

		<TableRowCell :title="roomName">
			<p class="text-on-surface-dim truncate text-sm italic">
				{{ roomName }}
			</p>
		</TableRowCell>

		<TableRowCell class="flex items-center gap-100">
			<span
				class="py-050 rounded-full px-150 text-sm"
				:class="typeClasses"
			>
				{{ typeLabel }}
			</span>
		</TableRowCell>

		<TableRowCell class="flex items-center gap-100">
			<span
				v-if="status"
				class="py-050 rounded-full px-150 text-sm"
				:class="statusClasses"
			>
				{{ statusLabel }}
			</span>
			<span v-else>-</span>
		</TableRowCell>
	</template>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Components
	import TableRowCell from '@hub-client/components/rooms/TableRowCell.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Composables
	import { type RoleInvitationStatus, type RoleType } from '@hub-client/composables/manage-roles.composable';
	import { useRoleDisplay } from '@hub-client/composables/roles-display.composable';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	const props = defineProps<{
		avatarUrl?: string;
		displayName: string;
		roomName: string;
		status?: RoleInvitationStatus;
		type: RoleType;
		userId: string;
	}>();

	defineEmits<{
		click: [];
	}>();

	const settings = useSettings();
	const { getTypeLabel, getTypeClasses, getStatusLabel, getStatusClasses } = useRoleDisplay();

	const isMobile = computed(() => settings.isMobileState);

	const typeLabel = computed(() => getTypeLabel(props.type));
	const typeClasses = computed(() => getTypeClasses(props.type));
	const statusLabel = computed(() => getStatusLabel(props.status));
	const statusClasses = computed(() => getStatusClasses(props.status));
</script>
