<template>
	<div v-if="settings.isFeatureEnabled(FeatureFlag.roomLibrary)" class="h-full p-2">
		<PopoverButton v-if="!messageInput.state.fileAdded" icon="upload" @click="startUploadFile">{{ $t('message.upload_file') }}</PopoverButton>
		<FilePicker ref="filePickerEl" :messageInput="messageInput" :submitButton="true" @submit="uploadFile"></FilePicker>
		<Icon v-if="!messageInput.state.fileAdded" class="absolute right-3 top-3 hover:text-accent-red" type="close" size="sm" @click="close()"></Icon>

		<div class="h-full w-full overflow-y-auto">
			<Table :keys="keys" @order="orderBy($event)">
				<template v-for="(item, rowIndex) in elRoomTimeline">
					<TableRow v-if="item.event.content?.msgtype === 'm.file' || item.event.content?.msgtype === 'm.image'" :key="rowIndex">
						<TableCell class="xs:max-w-24 sm:max-w-48 md:max-w-none">
							<div class="flex">
								<div class="xs:mr-1 xs:max-h-6 xs:w-6 md:mr-2 md:w-8">
									<Image v-if="isImage(item.event.content.filename)" :img="item.event.content.url"></Image>
									<Icon v-else type="paperclip"></Icon>
								</div>
								<span class="truncate">
									<FileDownload :url="item.event.content.url" :filename="item.event.content.filename"></FileDownload>
								</span>
							</div>
						</TableCell>
						<TableCell class="whitespace-nowrap">
							<span class="~text-label-small-min/label-small-max">
								{{ filters.formatBytes(item.event.content?.info?.size, 2) }}
							</span>
						</TableCell>
						<TableCell>
							<EventTime :timestamp="item.event.origin_server_ts!" :showDate="true" :timeForMsgPreview="true" class="justify-end"></EventTime>
						</TableCell>
						<TableCell class="xs:max-w-28 md:max-w-none">
							<div class="flex w-full justify-end xs:gap-1 md:gap-2">
								<Avatar :userId="item.event.sender" class="h-6 w-6"></Avatar>
								<DisplayName :userId="item.event.sender"></DisplayName>
							</div>
						</TableCell>
						<TableCell>
							<div class="flex w-full justify-end">
								<template v-if="isSigned(item.event.event_id)">
									<SignedDialog
										v-for="signedEvent in getAllSignedEventsForFile(item.event.event_id)"
										:key="signedEvent.event.sender"
										:event="signedEvent.event"
										:originalEvent="item.event"
										:room="rooms.rooms[props.id]"
										:attributes="selectedAttributes"
									></SignedDialog>
								</template>
								<IconButton v-else type="sign"  @click.stop="handleSigning(item.event.content.url, item.event.event_id)" class="cursor-pointer"></Icon>
							</div>
						</TableCell>
						<TableCell>
							<div class="flex flex-grow justify-end">
								<IconButton v-if="user.isAdmin" class="bg-hub-background-4 hover:bg-red flex rounded-md p-1" type="bin"  @click.stop="confirmDeletion(item.event.content, item.event.event_id)"></Icon>
							</div>
						</TableCell>
					</TableRow>
				</template>
			</Table>

			<template v-for="item in elRoomTimeline" :key="item.event.event_id">
				<Dialog v-if="signingMessage && activeEventId === item.event.event_id" :buttons="buttonsCancel" :title="$t('roomlibrary.sign_file_hash')" @close="signingMessage = false">
					<div class="flex flex-col items-center gap-4">
						<div class="text-center" id="yivi-web-form"></div>
						<div class="text-center">
							{{ $t('roomlibrary.sign_file_hash') }} `{{ item.event.content?.filename }}` : <span class="font-bold">{{ showFileHash }}</span> <br />
							{{ $t('roomlibrary.check_file_hash') }}
						</div>
					</div>
				</Dialog>
			</template>
		</div>

		<DeleteFileDialog v-if="showDeleteDialog" :eventContent="eventContentToShow" @close="showDeleteDialog = false" @yes="handleDeletion(eventContentToShow, eventIdHolder)"></DeleteFileDialog>
	</div>
</template>

<script setup lang="ts">
	//Components
	import DeleteFileDialog from '@/components/ui/DeleteFileDialog.vue';
	import SignedDialog from '@/components/ui/SignedDialog.vue';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';

	// Composables
	import { onMounted, ref, onUnmounted, watch } from 'vue';
	import { useRooms } from '@/logic/store/store';
	import { TSearchParameters } from '@/model/search/TSearch';
	import { TFileMessageEventContent, TImageMessageEventContent } from '@/model/events/TMessageEvent';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useRoomLibrary } from '@/logic/composables/useRoomLibrary';
	import { fileUpload } from '@/logic/composables/fileUpload';
	import { useMessageInput } from '@/logic/store/messageInput';
	import { YiviSigningSessionResult } from '@/model/components/signedMessages';
	import { useUser } from '@/logic/store/user';
	import { useRoute } from 'vue-router';
	import { MatrixEvent } from 'matrix-js-sdk';
	import { PubHubsMgType } from '@/logic/core/events';
	import { useI18n } from 'vue-i18n';
	import filters from '@/logic/core/filters';
	import FileDownload from '../ui/FileDownload.vue';
	import { buttonsCancel } from '@/logic/store/dialog';

	const emit = defineEmits(['close']);
	const { t } = useI18n();
	const rooms = useRooms();
	const user = useUser();
	const route = useRoute();

	const settings = useSettings();
	const pubhubs = usePubHubs();
	const messageInput = useMessageInput();
	const { makeHash, deleteMedia, updateTimeline, uri } = useRoomLibrary();
	const { allTypes, uploadUrl, formUrlfromMxc, deleteMediaUrlfromMxc, isImage } = useMatrixFiles();

	const signingMessage = ref<boolean>(false);
	const selectedAttributes = ref<string[]>(['irma-demo.sidn-pbdf.email.domain']);
	const activeEventId = ref<string | undefined>(undefined);
	const expandedSignedEventIds = ref<Set<string>>(new Set());
	// Used to update roomtimeline reactively for e.g. deleting
	const elRoomTimeline = ref<MatrixEvent[]>([]);
	const eventContentToShow = ref<TFileMessageEventContent | TImageMessageEventContent>();
	const showDeleteDialog = ref<boolean>(false);
	const filePickerEl = ref();
	const eventIdHolder = ref<string>('');
	const showFileHash = ref<string>('');
	const orderKey = ref('');
	const orderAsc = ref(true);

	const props = defineProps<{
		id: string;
	}>();
	const searchParameters = ref<TSearchParameters>({ roomId: props.id, term: '' });

	const getAllSignedEventsForFile = (eventId: string | undefined) => {
		// Get all signed events for the given file (using the event_id to match the related 'original' file event)
		const signed = elRoomTimeline.value.filter((e) => {
			return e.event.content?.msgtype === PubHubsMgType.SignedFileMessage && e.event.content?.['m.relates_to']?.event_id === eventId;
		});
		return signed;
	};

	const isSigned = (eventId: string | undefined) => {
		return getAllSignedEventsForFile(eventId).length > 0;
	};

	onMounted(() => {
		update();
		window.addEventListener('keydown', handleEsc);
	});

	onUnmounted(() => {
		window.removeEventListener('keydown', handleEsc);
		expandedSignedEventIds.value.clear();
	});

	watch(route, () => {
		update();
	});

	const keys = {
		name: {
			key: 'name',
			name: t('roomlibrary.info.name'),
			sortable: true,
			sortAsc: (a, b) => a.event.content.filename < b.event.content.filename,
			sortDesc: (a, b) => a.event.content.filename > b.event.content.filename,
		},
		size: {
			key: 'size',
			name: t('roomlibrary.info.filesize'),
			sortable: true,
			sortAsc: (a, b) => a.event.content?.info?.size < b.event.content?.info?.size,
			sortDesc: (a, b) => a.event.content?.info?.size > b.event.content?.info?.size,
		},
		date: {
			key: 'date',
			name: t('roomlibrary.info.uploaded_on'),
			sortable: true,
			sortAsc: (a, b) => a.event.origin_server_ts < b.event.origin_server_ts,
			sortDesc: (a, b) => a.event.origin_server_ts > b.event.origin_server_ts,
		},
		user: {
			key: 'user',
			name: t('roomlibrary.info.uploaded_by'),
			sortable: true,
			sortAsc: (a, b) => a.event.sender < b.event.sender,
			sortDesc: (a, b) => a.event.sender > b.event.sender,
		},
		signed: {
			key: 'signed',
			name: t('roomlibrary.info.sign'),
			sortable: false,
		},
		actions: { key: 'actions', sortable: false },
	};

	function update() {
		elRoomTimeline.value = rooms.rooms[props.id]
			.loadRoomlibrary()
			.getLiveTimeline()
			.getEvents()
			.filter((e) => e.event !== null);
		if (orderKey.value !== '') {
			let func = keys[orderKey.value].sortAsc;
			if (orderAsc.value) {
				func = keys[orderKey.value].sortDesc;
			}
			elRoomTimeline.value = elRoomTimeline.value.sort(func);
			// console.log('update sort', orderKey.value, orderAsc.value, func, elRoomTimeline.value);
		}
		searchParameters.value.roomId = rooms.currentRoom.roomId;
	}

	function orderBy(order: Object) {
		orderKey.value = order.key;
		orderAsc.value = order.asc;
		update();
	}

	function startUploadFile() {
		if (filePickerEl.value) {
			filePickerEl.value.openFile();
		}
	}

	function uploadFile() {
		messageInput.closeFileUpload();
		const syntheticEvent = {
			currentTarget: {
				files: [messageInput.state.fileAdded],
			},
		} as unknown as Event;
		fileUpload(t('errors.file_upload'), pubhubs.Auth.getAccessToken(), uploadUrl, allTypes, syntheticEvent, (url) => {
			pubhubs.addFile(rooms.currentRoomId, undefined, messageInput.state.fileAdded as File, url, '', PubHubsMgType.LibraryFileMessage);
			URL.revokeObjectURL(uri.value);
			messageInput.cancelFileUpload();
			update();
		});
	}

	function handleEsc(event: KeyboardEvent) {
		if (event.key === 'Escape' && signingMessage.value) {
			signingMessage.value = false;
			activeEventId.value = undefined;
		}
	}

	async function handleSigning(mxc: string, eventId: string | undefined) {
		signingMessage.value = true;
		activeEventId.value = eventId;
		const accessToken = pubhubs.Auth.getAccessToken();
		if (accessToken) {
			const url = formUrlfromMxc(mxc, true);

			const hashedFile = await makeHash(accessToken, url, props.id);
			showFileHash.value = hashedFile;

			rooms.yiviSignMessage(hashedFile, selectedAttributes.value, rooms.currentRoomId, undefined, finishedSigningMessage);
		}
	}
	// used this from MessageInput.vue
	async function finishedSigningMessage(result: YiviSigningSessionResult) {
		signingMessage.value = false;
		await pubhubs.addSignedFile(rooms.currentRoomId, result, activeEventId.value);
		update();
	}

	function confirmDeletion(eventContent: TFileMessageEventContent | TImageMessageEventContent, eventId: string) {
		showDeleteDialog.value = true;
		eventContentToShow.value = eventContent;
		eventIdHolder.value = eventId;
	}

	async function handleDeletion(eventContent: TFileMessageEventContent | TImageMessageEventContent | undefined, eventId: string) {
		if (eventContent) {
			const mxc = eventContent.url;
			const url = deleteMediaUrlfromMxc(mxc);
			await deleteMedia(url, eventId);
			update();
			// Update the room timeline
			const room = rooms.rooms[props.id];
			const allSignedEvents = getAllSignedEventsForFile(eventId);
			const newTimeline = await updateTimeline(eventId, room, allSignedEvents);
			if (newTimeline) {
				elRoomTimeline.value = newTimeline.getEvents();
			}
		}
	}

	function close() {
		emit('close');
	}
</script>
