<template>
	<div role="article" class="bg-surface-low @container flex w-full flex-col justify-between gap-4 rounded-xl p-6 shadow-md">
		<div class="flex items-center justify-between gap-2">
			<H2 class="line-clamp-2">{{ room.name }}</H2>
			<div v-if="isSecured" class="bg-accent-primary text-on-accent-primary rounded-base flex h-fit shrink-0 items-center justify-center px-2 py-1" :title="t('admin.secured_room')">
				<Icon type="shield"></Icon>
			</div>
		</div>

		<div class="h-16">
			<P class="line-clamp-2">{{ room.topic }}</P>
		</div>

		<div class="flex w-full flex-col gap-4 @sm:flex-row @sm:items-end @sm:justify-between">
			<div class="text-on-surface-dim text-label flex flex-wrap items-center gap-2">
				<div class="flex items-center gap-2">
					<Icon type="user" size="sm"></Icon>
					<span class="truncate whitespace-nowrap">{{ memberCount }}</span>
				</div>
				<div v-if="timestamp" class="flex items-center gap-2">
					<Icon type="clock" size="sm"></Icon>
					<span>{{ timestamp.toLocaleDateString() }}</span>
				</div>
			</div>

			<div class="shrink-0">
				<Button v-if="memberOfRoom" @click="enterRoom" :title="t('rooms.already_joined')" class="w-full whitespace-nowrap @sm:w-fit">
					{{ t('rooms.already_joined') }}
				</Button>
				<Button v-else-if="isSecured" @click="joinSecureRoom" class="w-full whitespace-nowrap @sm:w-fit" :title="t('rooms.view_access_requirements')" color="primary">
					{{ t('rooms.join_secured_room') }}
				</Button>
				<Button v-else @click="joinRoom" class="w-full whitespace-nowrap @sm:w-fit" :title="t('rooms.join_room')">
					{{ t('rooms.join_room') }}
				</Button>
			</div>
		</div>

		<RoomLoginDialog v-model:dialogOpen="dialogOpen" title="rooms.join_room" message="rooms.join_secured_room_dialog" :messageValues="[]" :secured="true" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// Setup
	const props = defineProps({
		room: {
			type: Object,
			required: true,
		},
		isSecured: {
			type: Boolean,
			default: false,
		},
		memberOfRoom: {
			type: Boolean,
			default: false,
		},
		timestamp: {
			type: Date,
			default: undefined,
		},
	});

	const { t } = useI18n();
	const router = useRouter();
	const user = useUser();
	const dialog = useDialog();
	const pubhubsStore = usePubhubsStore();
	const roomsStore = useRooms();
	const panelOpen = ref(false);
	const dialogOpen = ref<string | null>(null);

	// Compute member count string
	const memberCount = computed(() => {
		const count = props.isSecured ? props.room.num_joined_members - 1 : props.room.num_joined_members;
		const label = count === 1 ? t('rooms.member') : t('rooms.members');
		return `${count} ${label}`;
	});

	// Handle room join
	const joinRoom = async () => {
		if (!props.room?.room_id) return;

		await pubhubsStore.joinRoom(props.room.room_id);

		// Wait for room membership with timeout
		const maxRetries = 10;
		const retryDelay = 500;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const hasJoined = await pubhubsStore.isUserRoomMember(user.user.userId, props.room.room_id);
			if (hasJoined) break;

			if (attempt === maxRetries - 1) {
				dialog.confirm(t('rooms.try_again'));
			}

			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}

		// Check if room exists in store with timeout
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			if (roomsStore.roomExists(props.room.room_id)) {
				router.push({ name: 'room', params: { id: props.room.room_id } });
				return;
			}

			// Check if we've exceeded the timeout
			if (attempt === maxRetries - 1) {
				dialog.confirm(t('rooms.try_again'));
			}

			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	};

	const enterRoom = async () => {
		const maxRetries = 10;
		const retryDelay = 500;

		// Check if room exists in store with timeout
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			if (roomsStore.roomExists(props.room.room_id)) {
				router.push({ name: 'room', params: { id: props.room.room_id } });
				return;
			}

			// Check if we've exceeded the timeout
			if (attempt === maxRetries - 1) {
				dialog.confirm(t('rooms.try_again'));
			}

			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	};

	const joinSecureRoom = () => {
		dialogOpen.value = props.room.room_id;
		panelOpen.value = true;
	};
</script>
