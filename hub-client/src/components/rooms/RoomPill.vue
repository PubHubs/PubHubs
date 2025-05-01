<template>
	<div class="relative flex h-20 min-w-56 max-w-[36.8rem] cursor-pointer flex-col rounded-md bg-background shadow-md" @click="expandPillToggle()">
		<div class="flex h-full items-center">
			<div class="absolute left-0 top-0 h-full w-3 shrink-0 bg-surface-high transition-all duration-1000 ease-in-out" :class="{ 'w-full !bg-accent-primary': joinedARoom }"></div>
			<div class="flex h-min w-full justify-between p-2 py-3 pl-5" :class="{ 'gap-4': expanded }">
				<div class="flex items-center gap-4">
					<Icon :type="roomIsSecure ? 'shield' : 'speech_bubbles'" class="shrink-0" />
					<SecuredRoomLogin v-if="securedRoomLoginFlow && panelOpen" :securedRoomId="room.room_id" @click="panelOpen = false" />
					<div class="grid">
						<H3 class="relative z-0 m-0 line-clamp-1 overflow-hidden font-semibold" :class="{ 'line-clamp-3': expanded && !joinedARoom }">{{ room?.name }}</H3>

						<p v-if="joinedARoom === false" class="line-clamp-1 italic ~text-label-min/label-max" :class="{ 'line-clamp-3': expanded }">
							{{ room.topic }}
						</p>
						<p v-else class="~text-body-min/body-max z-0 line-clamp-1 truncate">{{ t('rooms.joined') }}</p>
					</div>
				</div>
				<div class="grid items-center gap-2">
					<Icon v-if="memberOfRoom" type="arrow-right" size="lg" class="min-w-[4rem] hover:cursor-pointer" @click="goToRoom()" />
					<Icon v-if="!memberOfRoom" type="join_room" size="lg" class="hover:cursor-pointer" @click="joinRoom()" />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';
	import H3 from '../elements/H3.vue';

	import { ref } from 'vue';
	import { router } from '@/logic/core/router';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useI18n } from 'vue-i18n';
	import { TPublicRoom } from '@/logic/store/rooms';
	import SecuredRoomLogin from '../ui/SecuredRoomLogin.vue';

	const pubhubs = usePubHubs();
	const { t } = useI18n();
	t;
	const expanded = ref(false);
	const joinedARoom = ref(false);
	const panelOpen = ref(true);

	type Props = {
		room: TPublicRoom;
		roomIsSecure: boolean;
		memberOfRoom: boolean;
		securedRoomLoginFlow: boolean;
	};

	const props = defineProps<Props>();

	const emit = defineEmits(['toggle-secured-room']);

	function expandPillToggle() {
		//In case of secured room, don't expand
		if (!(props.securedRoomLoginFlow && panelOpen)) {
			expanded.value = !expanded.value;
		}
	}

	async function joinRoom() {
		if (props.roomIsSecure && !props.memberOfRoom) {
			// Whenever user is not in the secured room, it means that secure room panel should be visible
			emit('toggle-secured-room'); // sets the props for open panel to true and only for current Room.
			panelOpen.value = true; // Resets the ref so that the panel can be opened and closed multiple times.
		} else {
			joinedARoom.value = true;
			setTimeout(() => {
				pubhubs.joinRoom(props.room.room_id);
			}, 1000);
		}
	}

	function goToRoom() {
		router.push({ name: 'room', params: { id: props.room.room_id } });
	}
</script>
