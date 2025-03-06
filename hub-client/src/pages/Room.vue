<template>
	<template v-if="rooms.currentRoomExists">
		<HeaderFooter v-if="plugin === false" :headerSize="'sm'" :headerMobilePadding="true">
			<template #header>
				<div class="hidden items-center gap-4 md:flex">
					<span class="text-xxs font-bold uppercase">{{ $t('rooms.room') }}</span>
					<hr class="grow" />
				</div>
				<div class="relative flex h-full justify-between gap-x-2">
					<div v-if="rooms.currentRoom" class="flex w-[75%] shrink-0 items-center gap-x-1 overflow-hidden md:w-[60%] md:gap-x-4">
						<Icon :type="rooms.currentRoom.isSecuredRoom() ? 'shield' : 'speech_bubbles'" size="lg"></Icon>
						<div class="flex flex-col">
							<H1 class="flex">
								<TruncatedText>
									<PrivateRoomName v-if="rooms.currentRoom.isPrivateRoom()" :members="rooms.currentRoom.getOtherJoinedAndInvitedMembers()"></PrivateRoomName>
									<RoomName v-else :room="rooms.currentRoom"></RoomName>
								</TruncatedText>
							</H1>
							<TruncatedText class="hidden md:inline">
								<RoomTopic :room="rooms.currentRoom"></RoomTopic>
							</TruncatedText>
						</div>
						<!-- Only show cog wheel in mobile view -->
						<Icon v-if="room.getUserPowerLevel(user.user.userId) === 50" type="cog" class="z-10 cursor-pointer md:hidden md:text-black" @click="moderatorCanEdit()"></Icon>
					</div>
					<!--Only show Editing icon for Moderator but not for administrator-->
					<div class="hidden items-center md:flex" v-if="room.getUserPowerLevel(user.user.userId) === 50">
						<div class="rounded-md border-2 border-gray-light bg-gray-light px-2 py-2 transition-colors hover:border-gray-middle hover:bg-gray-middle">
							<Icon type="cog" class="cursor-pointer text-white" @click="moderatorCanEdit()"></Icon>
						</div>
					</div>
					<SearchInput :search-parameters="searchParameters" @scroll-to-event-id="onScrollToEventId" :room="rooms.currentRoom"></SearchInput>
				</div>
			</template>

			<RoomTimeline v-if="room" :room="room" :scroll-to-event-id="scrollToEventId" @scrolled-to-event-id="scrollToEventId = ''"></RoomTimeline>

			<template #footer>
				<MessageInput v-if="room" :room="room"></MessageInput>
				<EditRoomForm v-if="showEditRoom" :room="currentRoomToEdit" :secured="secured" @close="closeEdit()"></EditRoomForm>
			</template>
		</HeaderFooter>

		<!-- Plugin Room -->
		<component v-if="plugin !== false && plugin !== true" :is="plugin.component"></component>
	</template>
</template>

<script setup lang="ts">
	// Components
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import Icon from '@/components/elements/Icon.vue';
	import H1 from '@/components/elements/H1.vue';
	import TruncatedText from '@/components/elements/TruncatedText.vue';
	import RoomName from '@/components/rooms/RoomName.vue';
	import RoomTopic from '@/components/rooms/RoomTopic.vue';
	import SearchInput from '@/components/forms/SearchInput.vue';
	import RoomTimeline from '@/components/rooms/RoomTimeline.vue';
	import MessageInput from '@/components/forms/MessageInput.vue';
	import PrivateRoomName from '@/components/rooms/PrivateRoomName.vue';

	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import { TSearchParameters } from '@/model/search/TSearch';
	import { useHubSettings } from '@/logic/store/hub-settings';
	import { PluginProperties, usePlugins } from '@/logic/store/plugins';
	import { useRooms } from '@/logic/store/rooms';
	import { useUser } from '@/logic/store/user';
	import { TPublicRoom, TSecuredRoom } from '@/store/store';
	import { computed, onMounted, ref, watch } from 'vue';
	import { useRoute, useRouter } from 'vue-router';

	const route = useRoute();
	const rooms = useRooms();
	const user = useUser();
	const router = useRouter();
	const plugins = usePlugins();
	const plugin = ref(false as boolean | PluginProperties);
	const hubSettings = useHubSettings();
	const currentRoomToEdit = ref<TSecuredRoom | TPublicRoom | null>(null);
	const showEditRoom = ref(false);
	const secured = ref(false);

	const pubhubs = usePubHubs();

	//Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
	});

	const searchParameters = ref<TSearchParameters>({ roomId: props.id, term: '' });
	const scrollToEventId = ref<string>('');

	const room = computed(() => {
		let r = rooms.rooms[props.id];
		if (!r) {
			// I want the side effect that should be avoided according to the lint rule.
			// eslint-disable-next-line
			router.push({ name: 'error-page', query: { errorKey: 'errors.cant_find_room' } });
		}
		return r;
	});

	onMounted(() => {
		update();
		LOGGER.log(SMI.ROOM, `Room mounted `);
	});

	watch(route, () => {
		update();
	});

	async function update() {
		hubSettings.hideBar();
		rooms.changeRoom(props.id);

		const userIsMemberOfRoom = await pubhubs.isUserRoomMember(user.user.userId, props.id);
		if (!userIsMemberOfRoom) {
			// if not a member: try to join, otherwise go to the hubpage
			pubhubs.joinRoom(props.id).catch(() => router.push({ name: 'hubpage' }));
		}

		if (!rooms.currentRoom) return;
		searchParameters.value.roomId = rooms.currentRoom.roomId;
		plugin.value = plugins.hasRoomPlugin(rooms.currentRoom);
	}

	async function onScrollToEventId(ev: any) {
		scrollToEventId.value = ev.eventId;
	}

	async function moderatorCanEdit() {
		currentRoomToEdit.value = await rooms.getTPublicOrTSecuredRoom(props.id);
		const isSecuredRoom = rooms.roomIsSecure(props.id);
		if (isSecuredRoom) secured.value = true;
		showEditRoom.value = true;
	}

	function closeEdit() {
		showEditRoom.value = false;
		secured.value = false;
	}
</script>
