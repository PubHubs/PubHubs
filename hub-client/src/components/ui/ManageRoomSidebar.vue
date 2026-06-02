<template>
	<div class="relative flex h-full flex-col overflow-y-hidden py-4">
		<SidebarHeader :title="t('admin.room_details')" />
		<div
			v-if="roomId"
			class="flex flex-1 flex-col gap-300 overflow-y-auto px-4 pb-16"
		>
			<!-- Room info card -->
			<div class="bg-surface-base rounded-base border-surface-elevated flex flex-col gap-200 border-3 p-200">
				<p class="truncate font-semibold">
					{{ roomName }}
				</p>
				<div class="flex items-center justify-between gap-200">
					<span class="text-label-small text-on-surface-dim first-letter:uppercase">
						{{ roomTypeDisplay }}
					</span>
					<div
						v-if="memberCount !== undefined"
						class="text-on-surface-dim flex items-center gap-1 text-sm"
					>
						<Icon
							type="user"
							size="sm"
						/>
						<span>{{ memberCount }}</span>
					</div>
				</div>
			</div>

			<!-- Description -->
			<div v-if="roomTopic">
				<CollapsibleHeader
					:label="t('admin.topic')"
					:collapsible="false"
				>
					<p class="text-sm italic first-letter:uppercase">
						{{ roomTopic }}
					</p>
				</CollapsibleHeader>
			</div>

			<!-- Yivi attributes -->
			<div v-if="securedRoom && yiviAttributeNames.length > 0">
				<CollapsibleHeader
					:label="t('rooms.yivi_attributes')"
					:collapsible="false"
				>
					<div class="flex flex-wrap gap-150">
						<Chip
							v-for="name in yiviAttributeNames"
							:key="name"
							:badge-label="name"
						>
							{{ name }}
						</Chip>
					</div>
				</CollapsibleHeader>
			</div>

			<!-- Stewards (admins + stewards combined) -->
			<div
				v-if="hasRoomData && combinedStewards.length > 0"
				class="pb-4"
			>
				<CollapsibleHeader :label="$t('rooms.stewards')">
					<template #right>
						<Pill :value="combinedStewards.length" />
					</template>
					<div
						v-for="steward in combinedStewards"
						:key="steward.userId"
						class="hover:bg-surface-low flex w-full cursor-pointer items-center gap-2 rounded-md p-2"
						@click="emit('navigateToUser', steward.userId)"
					>
						<Avatar
							:avatar-url="user.userAvatar(steward.userId)"
							:user-id="steward.userId"
							:room-id="props.roomId"
							:enable-d-m="false"
							class="h-8 w-8 shrink-0"
						/>
						<UserDisplayName
							:user-id="steward.userId"
							:user-display-name="user.userDisplayName(steward.userId)"
							:room-id="props.roomId"
							:enable-d-m="false"
						/><span
							v-if="steward.userId === user.userId"
							class="text-on-surface-dim"
							>&nbsp;{{ $t('admin.you_suffix') }}</span
						>
					</div>
				</CollapsibleHeader>
			</div>

			<!-- Members -->
			<div
				v-if="hasRoomData && nonPowerMemberIds.length > 0"
				class="pb-4"
			>
				<CollapsibleHeader :label="$t('rooms.members')">
					<template #right>
						<Pill :value="nonPowerMemberIds.length" />
					</template>
					<div
						v-for="userId in nonPowerMemberIds"
						:key="userId"
						class="hover:bg-surface-low flex w-full cursor-pointer items-center gap-2 rounded-md p-2"
						@click="emit('navigateToUser', userId)"
					>
						<Avatar
							:avatar-url="user.userAvatar(userId)"
							:user-id="userId"
							:room-id="props.roomId"
							:enable-d-m="false"
							class="h-8 w-8 shrink-0"
						/>
						<UserDisplayName
							:user-id="userId"
							:user-display-name="user.userDisplayName(userId)"
							:room-id="props.roomId"
							:enable-d-m="false"
						/><span
							v-if="userId === user.userId"
							class="text-on-surface-dim"
							>&nbsp;{{ $t('admin.you_suffix') }}</span
						>
					</div>
				</CollapsibleHeader>
			</div>
		</div>
		<div
			v-else
			class="flex h-full items-center justify-center px-4"
		>
			<p class="text-on-surface-dim text-center italic">
				{{ t('admin.select_room_placeholder') }}
			</p>
		</div>

		<!-- FABs -->
		<div
			v-if="roomId"
			class="absolute right-3 bottom-3 flex gap-2"
		>
			<FloatingActionButton
				:label="t('admin.go_to_room')"
				icon="arrow-right"
				@click="emit('goToRoom')"
			/>
			<FloatingActionButton
				v-if="isRoomAdmin"
				:label="t('admin.edit_room')"
				icon="pencil-simple"
				@click="emit('edit')"
			/>
			<FloatingActionButton
				v-if="isHubAdmin && !isRoomAdmin"
				:label="t('admin.upgrade_to_steward')"
				icon="arrow-circle-up"
				@click="emit('promote')"
			/>
			<FloatingActionButton
				v-if="isHubAdmin"
				:label="t('admin.remove_room')"
				color="error"
				icon="trash"
				@click="emit('remove')"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Chip from '@hub-client/components/elements/Chip.vue';
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Pill from '@hub-client/components/elements/Pill.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useRoomDetails } from '@hub-client/composables/useRoomDetails';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps({
		roomId: { type: String, default: '' },
		roomName: { type: String, default: '' },
		isRoomAdmin: { type: Boolean, default: false },
		isHubAdmin: { type: Boolean, default: false },
	});

	const emit = defineEmits<{
		goToRoom: [];
		edit: [];
		remove: [];
		promote: [];
		navigateToUser: [userId: string];
	}>();

	const { t } = useI18n();
	const user = useUser();

	const { securedRoom, roomTypeDisplay, memberCount, roomTopic, yiviAttributeNames, hasRoomData, combinedStewards, nonPowerMemberIds } = useRoomDetails(
		computed(() => props.roomId),
	);
</script>
