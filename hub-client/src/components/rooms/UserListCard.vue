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
					{{ userId }}
				</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-200 text-sm">
			<Icon
				v-if="isAdmin"
				size="sm"
				type="check"
			/>
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

		<TableRowCell :title="userId">
			<p class="text-on-surface-dim truncate text-sm italic">
				{{ userId }}
			</p>
		</TableRowCell>

		<TableRowCell class="flex items-center gap-100">
			<Icon
				v-if="isAdmin"
				size="sm"
				type="check"
			/>
		</TableRowCell>
	</template>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';
	// Components
	import TableRowCell from '@hub-client/components/rooms/TableRowCell.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	defineProps<{
		userId: string;
		displayName: string;
		avatarUrl?: string;
		isAdmin: boolean;
	}>();

	defineEmits<{
		click: [];
	}>();

	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);
</script>
