<template>
	<div class="dark:bg-gray-middle h-full w-full">
		<div
			v-if="!connectInputs"
			class="flex h-full flex-col items-center justify-center dark:text-white"
		>
			<h1 class="mb-8 text-6xl font-bold">Starting video call</h1>
			<div class="flex flex-col items-center justify-center text-center">
				<VideoCallPreview />
				<div class="flex w-1/2 items-center justify-center">
					<div class="mx-2 w-1/2">
						<h2>Microphone source</h2>
						<VideoCallDropDown
							value=""
							:options="audioOptions"
							:on-select="
								(audioDevice: string) => {
									audioDevice === `no device` ? videoCall.changeAudioDevice(null) : videoCall.changeAudioDevice(audioDevice);
								}
							"
						/>
					</div>
					<div class="mx-2 w-1/2">
						<h2>Video source</h2>
						<VideoCallDropDown
							value=""
							:options="videoOptions"
							:on-select="
								(videoDevice: string) => {
									videoDevice === `no device` ? videoCall.changeVideoDevice(null) : videoCall.changeVideoDevice(videoDevice);
								}
							"
						/>
					</div>
				</div>
				<div class="flex justify-center gap-2 pt-2">
					<!-- TODO add language variables -->
					<Button
						variant="primary"
						:disabled="!optionsLoaded"
						@click="joinRoom"
						>Join</Button
					>
					<Button
						variant="secondary"
						@click="findDevices"
						>Refresh devices</Button
					>
					<Button
						variant="tertiary"
						@click="goBack"
						>Exit</Button
					>
				</div>
			</div>
		</div>
		<div
			v-else
			class="relative flex h-full w-full flex-col items-center justify-between overflow-hidden dark:text-white"
		>
			<div class="flex h-full w-full justify-between overflow-hidden">
				<div class="relative flex h-full w-full flex-col overflow-hidden">
					<div class="absolute top-4 right-4 z-10">
						<Button
							variant="secondary"
							@click="toggleParticipantList"
							>{{ showParticipants ? 'Hide Participants' : 'Show Participants' }}</Button
						>
						<Button
							variant="secondary"
							@click="toggleChat"
							>{{ showChat ? 'Hide chat' : 'Show chat' }}</Button
						>
					</div>
					<div class="flex-grow">
						<VideoCallVideoCarrousel :remote-participants="remotes" />
					</div>
				</div>
				<VideoCallParticipantsList
					v-if="showParticipants"
					:remote-participants="remotesNames"
				/>
				<RoomThread
					v-if="currentRoom!.getCurrentThreadId() && showChat"
					:room="currentRoom!"
					:scroll-to-event-id="currentRoom!.getCurrentEvent()?.eventId"
					@scrolled-to-event-id="currentRoom!.setCurrentEvent(undefined)"
					@thread-length-changed="currentThreadLengthChanged"
				>
				</RoomThread>

				<div
					v-if="selfView"
					class="absolute right-4 bottom-20"
					:class="{ 'mr-[33%]': showParticipants || showChat }"
				>
					<VideoCallVideo
						:username="localParticipant.identity"
						:participant="localParticipant"
						:size="showParticipants || showChat ? 'w-[20vw]' : 'w-[25vw]'"
						:is-self-view="true"
					></VideoCallVideo>
				</div>
			</div>
			<VideoCallBottomBar :current-room="currentRoom" />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { Room as LivekitRoom, type LocalParticipant } from 'livekit-client';
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useRouter } from 'vue-router';

	import VideoCallDropDown from '@hub-client/components/forms/VideoCallDropDown.vue';
	import RoomThread from '@hub-client/components/rooms/RoomThread.vue';
	import VideoCallPreview from '@hub-client/components/ui/VideoCallPreview.vue';
	import VideoCallBottomBar from '@hub-client/components/videocall/VideoCallBottomBar.vue';
	import VideoCallParticipantsList from '@hub-client/components/videocall/VideoCallParticipantsList.vue';
	import VideoCallVideo from '@hub-client/components/videocall/VideoCallVideo.vue';
	import VideoCallVideoCarrousel from '@hub-client/components/videocall/VideoCallVideoCarrousel.vue';

	import { type Options } from '@hub-client/composables/useFormInputEvents';

	import { useRooms } from '@hub-client/stores/rooms';
	import useVideoCall from '@hub-client/stores/videoCall';

	import Button from '@hub-client/new-design/components/Button.vue';

	const videoCall = useVideoCall();
	const router = useRouter();
	const rooms = useRooms();
	const selfView = computed(() => videoCall.selfView);

	let audioOptions = ref<Options>([]);
	let videoOptions = ref<Options>([]);
	let connectInputs = ref(false);
	let remotes = ref<unknown[]>([]);
	let remotesNames = ref<string[]>([]);
	let showParticipants = ref(false);
	const showChat = computed(() => !!currentRoom.value?.getCurrentThreadId());
	let optionsLoaded = ref(false);

	let localParticipant = computed(() => {
		return videoCall.livekit_room?.localParticipant as LocalParticipant;
	});

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

	async function findDevices() {
		optionsLoaded.value = false;
		const audioDevices = await LivekitRoom.getLocalDevices('audioinput');

		audioOptions.value = audioDevices.map((device) => {
			return { label: device.label, value: device.deviceId };
		});
		audioOptions.value.unshift({ label: 'Select device', value: 'no device' });

		const videoDevices = await LivekitRoom.getLocalDevices('videoinput');

		videoOptions.value = videoDevices.map((device) => {
			return { label: device.label, value: device.deviceId };
		});
		videoOptions.value.unshift({ label: 'Select device', value: 'no device' });
		optionsLoaded.value = true;
	}

	//TODO see if I can combine these two arrays?
	function syncRemoteParticipants() {
		const temp: unknown[] = [];
		const tempNames: string[] = [];
		videoCall.livekit_room?.remoteParticipants.forEach((p) => {
			temp.push(p);
			tempNames.push(p.identity);
		});
		remotes.value = temp;
		remotesNames.value = tempNames;
	}

	function setupLivekitListeners() {
		if (!videoCall.livekit_room) return;
		syncRemoteParticipants();

		videoCall.livekit_room.removeAllListeners();
		videoCall.livekit_room.on('participantConnected', () => syncRemoteParticipants());
		videoCall.livekit_room.on('participantDisconnected', () => syncRemoteParticipants());
		videoCall.livekit_room.on('localTrackPublished', () => syncRemoteParticipants());
		videoCall.livekit_room.on('trackPublished', () => syncRemoteParticipants());
		videoCall.livekit_room.on('localTrackUnpublished', () => syncRemoteParticipants());
		videoCall.livekit_room.on('trackUnpublished', () => syncRemoteParticipants());
		videoCall.livekit_room.on('encryptionError', (e) => {
			syncRemoteParticipants();
			void e;
		});
		videoCall.livekit_room.on('participantEncryptionStatusChanged', () => syncRemoteParticipants());
		videoCall.livekit_room.on('trackUnsubscribed', () => syncRemoteParticipants());
		videoCall.livekit_room.on('trackSubscribed', () => syncRemoteParticipants());
		videoCall.livekit_room.on('videoPlaybackChanged', () => syncRemoteParticipants());
		videoCall.livekit_room.on('trackMuted', () => syncRemoteParticipants());
		videoCall.livekit_room.on('trackUnmuted', () => syncRemoteParticipants());
	}

	onMounted(async () => {
		await findDevices();
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

	onUnmounted(async () => {
		if (!videoCall.livekit_room) return;
		videoCall.livekit_room.removeAllListeners();
	});

	function goBack() {
		if (!currentRoom.value) return;
		videoCall.leaveCall();
		router.push({ name: 'room', params: { id: currentRoom.value.roomId } });
	}

	function joinRoom() {
		connectInputs.value = true;
		videoCall.togglePublishTracks(true);
		syncRemoteParticipants();
	}

	function toggleParticipantList() {
		if (!currentRoom.value) return;
		currentRoom.value.setCurrentThreadId(undefined);
		showParticipants.value = !showParticipants.value;
	}

	function toggleChat() {
		if (!currentRoom.value) return;
		if (!videoCall.eventId) return;
		if (showChat.value) {
			currentRoom.value.setCurrentThreadId(undefined);
		} else {
			currentRoom.value.setCurrentThreadId(videoCall.eventId);
		}
		showParticipants.value = false;
	}

	function currentThreadLengthChanged(newLength: number) {
		if (!currentRoom.value) return;
		currentRoom.value.setCurrentThreadLength(newLength);
	}
</script>
