<template>
	<div class="relative flex h-full flex-col overflow-y-hidden py-4">
		<SidebarHeader :title="displayName ? (userId === currentUserId ? `${displayName} ${t('admin.you_suffix')}` : displayName) : t('admin.user_details')" />
		<div
			v-if="userId"
			class="flex flex-1 flex-col gap-300 overflow-y-auto px-4 pb-16"
		>
			<!-- User info card -->
			<div class="bg-surface-base rounded-base border-surface-elevated flex flex-col gap-200 border-3 p-200">
				<div class="flex items-center gap-3">
					<Avatar
						:avatar-url="user.userAvatar(userId)"
						:user-id="userId"
						:enable-d-m="false"
						class="h-10 w-10 shrink-0"
					/>
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">
							{{ displayName
							}}<span
								v-if="userId === currentUserId"
								class="text-on-surface-dim"
								>&nbsp;{{ t('admin.you_suffix') }}</span
							>
						</p>
						<p class="text-on-surface-dim truncate text-sm">
							{{ pseudonym }}
						</p>
					</div>
				</div>
			</div>

			<!-- Rooms -->
			<div v-if="visibleRooms.length > 0">
				<CollapsibleHeader :label="isAdmin ? t('rooms.rooms') : t('admin.rooms_you_moderate')">
					<template #right>
						<Pill :value="visibleRooms.length" />
					</template>
					<div
						v-for="room in visibleRooms"
						:key="room.roomId"
						class="hover:bg-surface-low flex w-full cursor-pointer items-center gap-2 rounded-md p-2"
						@click="emit('navigateToRoom', room.roomId)"
					>
						<span class="truncate text-sm">{{ room.name }}</span>
					</div>
				</CollapsibleHeader>
			</div>
		</div>
		<div
			v-else
			class="flex h-full items-center justify-center px-4"
		>
			<p class="text-on-surface-dim text-center italic">
				{{ t('admin.select_user_placeholder') }}
			</p>
		</div>

		<!-- FABs -->
		<div
			v-if="userId"
			class="absolute right-3 bottom-3 flex gap-2"
		>
			<FloatingActionButton
				v-if="isAdmin"
				:label="t('admin.edit_room')"
				icon="pencil-simple"
				@click="emit('edit')"
			/>
			<FloatingActionButton
				v-if="userId !== currentUserId"
				:label="t('admin.dm_user')"
				icon="chat-circle"
				@click="user.goToUserRoom(userId)"
			/>
			<FloatingActionButton
				v-if="userId !== currentUserId"
				:label="t('admin.ask_disclosure_title')"
				icon="lock-open"
				@click="emit('disclose')"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type PropType, computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	// Components
	import Pill from '@hub-client/components/elements/Pill.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useUserRooms } from '@hub-client/composables/useUserRooms';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { type Administrator } from '@hub-client/models/hubmanagement/models/admin';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps({
		userId: { type: String, default: '' },
		displayName: { type: String, default: '' },
		administrator: { type: Object as PropType<Administrator | null>, default: null },
		isAdmin: { type: Boolean, default: false },
	});

	const emit = defineEmits<{
		edit: [];
		disclose: [];
		navigateToRoom: [roomId: string];
	}>();

	const { t } = useI18n();
	const user = useUser();
	const currentUserId = computed(() => user.userId);

	const { visibleRooms } = useUserRooms(
		computed(() => props.userId),
		computed(() => props.isAdmin),
	);

	const pseudonym = computed(() => {
		if (!props.userId) return '';
		return filters.extractPseudonym(props.userId);
	});
</script>
