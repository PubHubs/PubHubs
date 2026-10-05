<template>
	<div
		ref="callContainer"
		class="h-full w-full"
	>
		<VideoCallPreJoin
			v-if="!connectInputs"
			@exit="goBack()"
			@join="joinRoom()"
		/>

		<div
			v-else
			class="flex h-full w-full flex-col overflow-hidden"
		>
			<!-- Same header shape as a room: name on the left, sidebar toggles on the right. -->
			<div class="border-on-surface-disabled/25 flex h-1000 shrink-0 items-center justify-between gap-200 border-b-2 p-200">
				<div
					v-if="currentRoom"
					class="flex min-w-0 flex-1 items-center gap-150 overflow-hidden"
				>
					<Icon type="video" />
					<H3 class="text-on-surface flex min-w-0">
						<TruncatedText class="font-headings font-semibold">
							<PrivateRoomHeader
								v-if="currentRoom.isPrivateRoom()"
								:room="currentRoom"
								:members="currentRoom.getOtherJoinedAndInvitedMembers()"
							/>
							<GroupRoomHeader
								v-else-if="currentRoom.isGroupRoom()"
								:room="currentRoom"
								:members="currentRoom.getOtherJoinedAndInvitedMembers()"
							/>
							<AdminContactRoomHeader
								v-else-if="currentRoom.isAdminContactRoom()"
								:room="currentRoom"
								:members="currentRoom.getOtherJoinedAndInvitedMembers()"
							/>
							<RoomName
								v-else
								:room="currentRoom"
							/>
						</TruncatedText>
					</H3>
				</div>

				<RoomHeaderButtons>
					<GlobalBarButton
						type="users"
						:selected="sidebar.activeTab.value === SidebarTab.Members"
						:aria-label="t('videocall.participants')"
						:title="t('videocall.participants')"
						@click="sidebar.toggleTab(SidebarTab.Members)"
					/>
					<GlobalBarButton
						v-if="videoCall.eventId"
						type="chat-circle"
						:selected="sidebar.activeTab.value === SidebarTab.Thread"
						:aria-label="t('videocall.chat')"
						:title="t('videocall.chat')"
						@click="toggleChat()"
					/>
				</RoomHeaderButtons>
			</div>

			<div class="flex flex-1 overflow-hidden">
				<div class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
					<div class="grow overflow-hidden">
						<VideoCallVideoCarrousel :remote-participants="remotes" />
					</div>

					<div
						v-if="selfView"
						class="absolute right-200 bottom-900 w-[25vw] max-w-4000"
					>
						<VideoCallVideo
							:username="localParticipant.identity"
							:participant="localParticipant"
							size=""
							:is-self-view="true"
						/>
					</div>

					<VideoCallBottomBar
						:current-room="currentRoom"
						:is-fullscreen="isFullscreen"
						@toggle-fullscreen="toggleFullscreen"
					/>
				</div>

				<RoomSidebar
					:active-tab="sidebar.activeTab.value"
					:is-mobile="sidebar.isMobile.value ?? false"
				>
					<VideoCallParticipantsList
						v-if="sidebar.activeTab.value === SidebarTab.Members"
						:remote-participants="remotesNames"
					/>
					<RoomThread
						v-else-if="sidebar.activeTab.value === SidebarTab.Thread && currentRoom?.getCurrentThreadId()"
						:room="currentRoom"
						:scroll-to-event-id="currentRoom.getCurrentEvent()?.eventId"
						@scrolled-to-event-id="currentRoom.setCurrentEvent(undefined)"
					/>
				</RoomSidebar>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { type LocalParticipant, type RemoteParticipant } from 'livekit-client';
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import AdminContactRoomHeader from '@hub-client/components/rooms/AdminContactRoomHeader.vue';
	import GroupRoomHeader from '@hub-client/components/rooms/GroupRoomHeader.vue';
	import PrivateRoomHeader from '@hub-client/components/rooms/PrivateRoomHeader.vue';
	import RoomHeaderButtons from '@hub-client/components/rooms/RoomHeaderButtons.vue';
	import RoomName from '@hub-client/components/rooms/RoomName.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import RoomThread from '@hub-client/components/rooms/RoomThread.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import VideoCallBottomBar from '@hub-client/components/videocall/VideoCallBottomBar.vue';
	import VideoCallParticipantsList from '@hub-client/components/videocall/VideoCallParticipantsList.vue';
	import VideoCallPreJoin from '@hub-client/components/videocall/VideoCallPreJoin.vue';
	import VideoCallVideo from '@hub-client/components/videocall/VideoCallVideo.vue';
	import VideoCallVideoCarrousel from '@hub-client/components/videocall/VideoCallVideoCarrousel.vue';

	// Composables
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import useVideoCall from '@hub-client/stores/videoCall';

	const { t } = useI18n();
	const videoCall = useVideoCall();
	const router = useRouter();
	const rooms = useRooms();
	const sidebar = useSidebar();
	const logger = createLogger('VideoCallPage');
	const selfView = computed(() => videoCall.selfView);

	const callContainer = ref<HTMLElement | null>(null);
	const isFullscreen = ref(false);

	const connectInputs = ref(false);

	const remotes = ref<unknown[]>([]);
	const remotesNames = computed(() => remotes.value.map((participant) => (participant as RemoteParticipant).identity));

	const localParticipant = computed(() => videoCall.livekit_room?.localParticipant as LocalParticipant);

	const currentRoom = computed(() => rooms.rooms[rooms.currentRoomId]);
	watch(
		currentRoom,
		(room) => {
			if (!room) {
				void router.push({ name: 'error-page', query: { errorKey: 'errors.cant_find_room' } });
			}
		},
		{ immediate: true },
	);

	const syncRemoteParticipants = () => {
		remotes.value = [...(videoCall.livekit_room?.remoteParticipants.values() ?? [])];
	};

	// Every one of these means the participant list may have changed
	const participantEvents = [
		'participantConnected',
		'participantDisconnected',
		'participantEncryptionStatusChanged',
		'localTrackPublished',
		'localTrackUnpublished',
		'trackPublished',
		'trackUnpublished',
		'trackSubscribed',
		'trackUnsubscribed',
		'trackMuted',
		'trackUnmuted',
		'videoPlaybackChanged',
		'encryptionError',
	] as const;

	const setupLivekitListeners = () => {
		if (!videoCall.livekit_room) return;
		syncRemoteParticipants();

		videoCall.livekit_room.removeAllListeners();
		participantEvents.forEach((event) => videoCall.livekit_room?.on(event, () => syncRemoteParticipants()));
	};

	const toggleFullscreen = async () => {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await callContainer.value?.requestFullscreen();
			}
		} catch (error) {
			logger.error('Could not toggle fullscreen', { error });
		}
	};

	const handleFullscreenChange = () => {
		isFullscreen.value = !!document.fullscreenElement;
	};

	const handleKeydown = (event: KeyboardEvent) => {
		// Don't hijack the key while the user is typing (e.g. in-call chat thread).
		const target = event.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
			return;
		}
		if (event.shiftKey && event.key.toLowerCase() === 'f') {
			event.preventDefault();
			void toggleFullscreen();
		}
	};

	onMounted(() => {
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('keydown', handleKeydown);
		setupLivekitListeners();
	});

	// If livekit_room wasn't ready at mount time (e.g., startCall() still in progress),
	// set up listeners as soon as it becomes available.
	watch(
		() => videoCall.livekit_room,
		(newRoom) => {
			if (newRoom) {
				setupLivekitListeners();
			}
		},
	);

	onUnmounted(() => {
		sidebar.closeInstantly();
		document.removeEventListener('fullscreenchange', handleFullscreenChange);
		document.removeEventListener('keydown', handleKeydown);
		if (document.fullscreenElement) {
			void document.exitFullscreen().catch((error) => logger.error('Could not exit fullscreen on unmount', { error }));
		}
		if (!videoCall.livekit_room) return;
		videoCall.livekit_room.removeAllListeners();
	});

	const goBack = () => {
		if (!currentRoom.value) return;
		void router.push({ name: 'room', params: { id: currentRoom.value.roomId } });
	};

	const joinRoom = async () => {
		const connected = await videoCall.joinCall();
		if (!connected) return;
		connectInputs.value = true;
		videoCall.togglePublishTracks(true);
		syncRemoteParticipants();
	};

	// RoomThread renders whatever thread the room points at, so open the call's own thread alongside
	// the tab rather than leaving a stale one selected.
	const toggleChat = () => {
		if (!currentRoom.value || !videoCall.eventId) return;

		if (sidebar.activeTab.value === SidebarTab.Thread) {
			currentRoom.value.setCurrentThreadId(undefined);
			sidebar.close();
			return;
		}

		currentRoom.value.setCurrentThreadId(videoCall.eventId);
		sidebar.openTab(SidebarTab.Thread);
	};
</script>
