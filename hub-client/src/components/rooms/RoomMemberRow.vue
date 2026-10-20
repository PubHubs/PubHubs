<template>
	<div
		v-context-menu="onContextMenu"
		class="flex w-full items-center gap-100 rounded-md p-100"
		:class="[clickable && 'hover:bg-surface-elevated cursor-pointer', isContextMenuTarget && 'bg-surface-elevated']"
		@click="onClick"
	>
		<UserBadge
			:user-id="userId"
			:room-id="roomId"
			size="lg"
		>
			<div class="flex items-center gap-100">
				<span
					v-if="userId === user.userId"
					class="text-on-surface-dim"
					>{{ t('admin.you_suffix') }}</span
				>
				<!-- Trailing state indicator: warning icon, timeout countdown, ... -->
				<slot />
			</div>
		</UserBadge>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import UserBadge from '@hub-client/components/ui/UserBadge.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';

	// Models
	import { type MenuItem } from '@hub-client/models/components/contextMenu.models';

	// Stores
	import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
	import { useUser } from '@hub-client/stores/user';

	const props = withDefaults(
		defineProps<{
			clickable?: boolean;
			menuItems?: MenuItem[];
			roomId?: string;
			userId: string;
		}>(),
		{
			clickable: false,
			menuItems: () => [],
			roomId: undefined,
		},
	);

	const emit = defineEmits<{ select: [userId: string] }>();

	const { t } = useI18n();
	const user = useUser();
	const contextMenuStore = useContextMenuStore();
	const { openMenu } = useContextMenu();

	const isContextMenuTarget = computed(() => contextMenuStore.isOpen && contextMenuStore.currentTargetId === props.userId);

	// An empty item list is a no-op in the store, so rows without actions simply do nothing.
	const onContextMenu = (event: Event) => openMenu(event as MouseEvent, props.menuItems, props.userId);

	const onClick = () => {
		if (props.clickable) emit('select', props.userId);
	};
</script>
