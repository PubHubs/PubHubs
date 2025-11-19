<template>
	<div role="article" class="flex h-[320px] w-full flex-col rounded-xl shadow-sm transition-all duration-300 xs:w-auto" :class="isExpanded ? 'row-span-2 h-[672px] bg-surface' : 'h-[320px] bg-surface-low'">
		<!-- Main card -->
		<div class="flex h-[320px] w-full shrink-0 flex-col gap-4 overflow-hidden rounded-xl bg-surface-low py-8 shadow-md">
			<div class="flex items-center justify-between">
				<H2 class="line-clamp-2 w-2/3 pl-8">{{ room.name }}</H2>
				<div v-if="isSecured" class="flex h-fit items-center justify-center rounded-l-lg bg-accent-primary py-2 pl-2 pr-4 text-on-accent-primary" :title="t('admin.secured_room')">
					<Icon type="shield"></Icon>
				</div>
			</div>
			<div class="flex h-full flex-col gap-4 px-8">
				<div class="flex h-full items-center">
					<P class="line-clamp-2">{{ room.topic }}</P>
				</div>

				<div class="flex w-full items-end justify-between gap-4">
					<div class="flex flex-row flex-wrap gap-4 overflow-hidden text-on-surface-dim text-label">
						<div class="flex items-center gap-2">
							<Icon type="user" size="sm"></Icon>
							<span class="truncate whitespace-nowrap">{{ memberCount }}</span>
						</div>
						<div v-if="timestamp" class="flex items-center gap-2">
							<Icon type="clock" size="sm"></Icon>
							<span> {{ timestamp.toLocaleDateString().slice(0, 6) + timestamp.toLocaleDateString().slice(8, 10) }} {{ timestamp.toLocaleTimeString().slice(0, 5) }}</span>
						</div>
					</div>

					<div class="hidden lg:block">
						<Button v-if="memberOfRoom" @click="enterRoom" :title="t('rooms.already_joined')" class="w-fit shrink-0 whitespace-nowrap">
							{{ t('rooms.already_joined') }}
						</Button>
						<Button v-else-if="isSecured" @click="toggleExpand" class="w-fit shrink-0" :title="t('rooms.view_access_requirements')" :color="!isExpanded ? 'primary' : 'secondary'">
							{{ !isExpanded ? t('rooms.view_access_requirements') : t('rooms.close_access_requirements') }}
						</Button>

						<Button v-else @click="joinRoom" class="w-fit shrink-0 whitespace-nowrap" :title="t('rooms.join_room')">
							{{ t('rooms.join_room') }}
						</Button>
					</div>
				</div>
				<div class="mt-4 block lg:hidden">
					<Button v-if="memberOfRoom" @click="enterRoom" :title="t('rooms.already_joined')" class="w-fit shrink-0 whitespace-nowrap">
						{{ t('rooms.already_joined') }}
					</Button>
					<Button v-else-if="isSecured" @click="toggleExpand" class="w-fit shrink-0" :title="t('rooms.view_access_requirements')" :color="!isExpanded ? 'primary' : 'secondary'">
						{{ !isExpanded ? t('rooms.view_access_requirements') : t('rooms.close_access_requirements') }}
					</Button>

					<Button v-else @click="joinRoom" class="w-fit shrink-0 whitespace-nowrap" :title="t('rooms.join_room')">
						{{ t('rooms.join_room') }}
					</Button>
				</div>
			</div>
		</div>

		<!-- Expanded card for secure rooms -->
		<div v-if="isSecured && isExpanded" class="mt-8 flex h-full max-h-[320px] flex-col gap-4 bg-surface p-8">
			<H2 class="w-full">{{ t('admin.secured_description') }}</H2>
			<div class="h-full overflow-y-auto">
				<P class="mb-4">{{ accessVerifytext }}</P>
				<div v-if="securedAttributes" class="flex flex-wrap items-center gap-y-2">
					<div class="flew-row flex items-center gap-1">
						<Icon v-if="memberOfRoom" type="lock-open" size="sm"></Icon>
						<Icon v-else type="lock" size="sm"></Icon>
						<P>{{ $t('attribute.heading') }}</P>
					</div>
					<div v-for="attribute in securedAttributes" :key="attribute.id" class="">
						<div class="float-left ml-1 rounded-3xl bg-surface-high p-1 px-2 text-label-small">
							<P class="">{{ $t('attribute.' + attribute) }}</P>
						</div>
						<P class="float-left">&nbsp;</P>
					</div>
				</div>
				<P v-else> {{ $t('common.loading') }}</P>
			</div>
			<div class="flex w-full items-end justify-end gap-8">
				<Button @click="joinSecureRoom" class="w-fit shrink-0 truncate whitespace-nowrap">
					{{ t('rooms.join_secured_room') }}
				</Button>

				<!-- Secure room join dialog -->
				<SecuredRoomLoginDialog v-model:dialogOpen="dialogOpen" title="rooms.join_room" message="rooms.join_secured_room_dialog" :messageValues="[]" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';
	import SecuredRoomLoginDialog from '@hub-client/components/rooms/SecuredRoomLoginDialog.vue';

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
		isExpanded: {
			type: Boolean,
			default: false,
		},
		timestamp: {
			type: Date,
			required: true,
		},
	});

	const { t } = useI18n();
	const router = useRouter();
	const user = useUser();
	const dialog = useDialog();
	const pubhubsStore = usePubhubsStore();
	const roomsStore = useRooms();
	const accessVerifytext = ref('');
	const panelOpen = ref(false);
	const dialogOpen = ref<string | null>(null);
	const securedAttributes = ref();

	// Compute member count string
	const memberCount = computed(() => {
		const count = props.isSecured ? props.room.num_joined_members - 1 : props.room.num_joined_members;
		const label = count === 1 ? t('rooms.member') : t('rooms.members');
		return `${count} ${label}`;
	});

	// Handle expand
	const emit = defineEmits(['toggleExpand']);

	const toggleExpand = () => {
		emit('toggleExpand', props.room.room_id);
	};

	watch(
		() => props.isExpanded,
		async (expanded) => {
			if (expanded && props.isSecured) {
				const securedRoom = await roomsStore.getSecuredRoomInfo(props.room.room_id);
				accessVerifytext.value = securedRoom?.user_txt ?? '';
				securedAttributes.value = securedRoom?.accepted ? Object.keys(securedRoom.accepted) : undefined;
			}
		},
		{ immediate: true },
	);

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
