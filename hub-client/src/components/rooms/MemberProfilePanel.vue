<template>
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Back button (fixed header; content below scrolls) -->
		<button
			class="text-on-surface-dim border-on-surface-disabled/25 flex items-center gap-100 border-y-2 px-200 py-150 transition-colors hover:cursor-pointer"
			type="button"
			@click="$emit('back')"
		>
			<Icon
				size="sm"
				type="caret-left"
			/>
			<span class="text-body-small">{{ t('dialog.back') }}</span>
		</button>

		<!-- Scrollable content -->
		<div class="flex flex-1 flex-col gap-300 overflow-y-auto px-200 pt-300 pb-400">
			<!-- Public profile -->
			<div class="bg-surface-base rounded-base border-surface-elevated flex items-center gap-150 border-3 p-200 transition-colors">
				<Avatar
					:avatar-url="userStore.userAvatar(userId)"
					:user-id="userId"
					:room-id="room.roomId"
					class="h-10 w-10 shrink-0"
				/>
				<div class="gap-050 flex min-w-0 flex-1 flex-col items-start">
					<UserDisplayName
						:user-id="userId"
						:user-display-name="userStore.userDisplayName(userId)"
						:room-id="room.roomId"
					/>
					<RoomBadge
						:room-id="room.roomId"
						:user="userId"
					/>
				</div>
				<Icon
					v-if="warned && !banned"
					type="exclamation-mark"
					class="text-accent-yellow"
				/>
				<Icon
					v-if="banned"
					type="exclamation-mark"
					class="text-accent-red"
				/>
				<div
					v-if="formattedTimeout"
					class="text-accent-red-interactive gap-050 flex items-center"
				>
					<Icon
						type="clock"
						size="sm"
					/>
					<span class="text-label-small">{{ formattedTimeout }}</span>
				</div>
			</div>

			<!-- Actions (DM always, plus steward actions) -->
			<div
				v-if="actions.length"
				class="gap-050 flex flex-col"
			>
				<template
					v-for="(item, index) in actions"
					:key="index"
				>
					<hr
						v-if="item.divider"
						class="border-on-surface-disabled/25 my-050"
					/>
					<button
						v-else
						class="hover:bg-surface-elevated rounded-base flex items-center gap-150 p-150 text-left transition-colors hover:cursor-pointer"
						:class="item.variant"
						type="button"
						:title="item.title"
						@click="item.onClick?.()"
					>
						<Icon
							v-if="item.icon"
							size="sm"
							:type="item.icon"
						/>
						<span class="text-label-small">{{ item.label }}</span>
					</button>
				</template>
			</div>

			<!-- Shared secured rooms -->
			<CollapsibleHeader
				v-if="sharedSecuredRooms.length"
				:label="t('rooms.profile_shared_secured_rooms')"
			>
				<template #right>
					<Pill :value="sharedSecuredRooms.length" />
				</template>
				<RoomLink
					v-for="r in sharedSecuredRooms"
					:key="r.roomId"
					:room-id="r.roomId"
					:name="r.name"
				/>
			</CollapsibleHeader>

			<!-- Public rooms in common -->
			<CollapsibleHeader
				v-if="commonPublicRooms.length"
				:label="t('rooms.profile_public_rooms')"
			>
				<template #right>
					<Pill :value="commonPublicRooms.length" />
				</template>
				<RoomLink
					v-for="r in commonPublicRooms"
					:key="r.roomId"
					:room-id="r.roomId"
					:name="r.name"
				/>
			</CollapsibleHeader>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Pill from '@hub-client/components/elements/Pill.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import RoomLink from '@hub-client/components/ui/RoomLink.vue';

	// Models
	import { type MenuItem } from '@hub-client/models/components/contextMenu.models';
	import type Room from '@hub-client/models/rooms/Room';
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		room: Room;
		userId: string;
		actions: MenuItem[];
		warned: boolean;
		banned: boolean;
		formattedTimeout: string;
	}>();

	defineEmits<{ back: [] }>();

	const { t } = useI18n();
	const rooms = useRooms();
	const userStore = useUser();

	// A room is "shared" with the selected user when they have joined it too.
	// We can only inspect rooms the current (viewing) user has joined, so public
	// rooms shown here are the ones both users have in common, not the full set.
	//
	// getMember() only sees lazily-loaded members, so for rooms whose member list
	// hasn't been loaded it returns null. Fall back to the sliding-sync room-list
	// state events (same approach as useUserRooms) so shared rooms still show up.
	const hasJoined = (room: Room): boolean => {
		if (room.getMember(props.userId)?.membership === 'join') return true;
		const entry = rooms.roomList.find((e) => e.roomId === room.roomId);
		return !!entry?.stateEvents.some((e) => e.type === 'm.room.member' && e.state_key === props.userId && e.content?.membership === 'join');
	};

	const sharedSecuredRooms = computed(() => rooms.roomsArray.filter((r) => r.isSecuredRoom() && hasJoined(r)));

	const commonPublicRooms = computed(() => rooms.roomsArray.filter((r) => (r.getType() === RoomType.PH_MESSAGES_DEFAULT || r.isForumRoom()) && hasJoined(r)));
</script>
