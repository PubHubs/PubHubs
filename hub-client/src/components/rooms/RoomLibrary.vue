<template>
	<div v-if="settings.isFeatureEnabled(FeatureFlag.roomLibrary)" class="flex h-full w-full gap-8 overflow-auto p-4 max-md:max-h-full max-md:flex-col max-md:gap-2">
		<div class="max-h-full w-full md:w-2/3">
			<div class="mb-4 flex w-full gap-4">
				<div class="flex w-1/2 items-center justify-end rounded-md bg-surface-low sm:w-3/4">
					<input
						class="h-full w-full flex-1 border-none bg-transparent ~text-base-min/base-max placeholder:text-on-surface-variant focus:outline-0 focus:outline-offset-0 focus:ring-0"
						type="text"
						role="searchbox"
						v-model="filter"
						:placeholder="t('others.search')"
						:title="t('others.search')"
					/>
					<button @click=""><Icon type="magnifying-glass" class="mr-1 rounded-md bg-transparent text-accent-secondary dark:text-on-surface-variant" size="md" /></button>
				</div>
				<div class="flex w-1/2 sm:w-1/4">
					<PullDownMenu :title="t('roomlibrary.info.sortby')" :options="orderByOptionsNames" :selected="order" :toggleOrder="true" @select="setOrderBy($event)"></PullDownMenu>
				</div>
			</div>

			<BarList v-if="roomTimeLineFiles.length > 0" class="max-h-fit" data-testid="filemanager">
				<BarListItem v-if="user.isAdmin" class="!mb-0 flex justify-end !bg-background" data-testid="filemanager-admin">
					<div class="flex items-center gap-1">
						<IconButton v-if="hasSelection()" type="trash" class="hover:text-accent-red" @click.stop="deleteSelected()"></IconButton>
						<IconButton v-if="!selectedAll" type="square" @click.stop="selectAll(roomTimeLineFiles)"></IconButton>
						<IconButton v-else type="check-square" @click.stop="unselectAll()"></IconButton>
					</div>
				</BarListItem>
				<div data-testid="filemanager-list">
					<template v-for="item in roomTimeLineFiles">
						<BarListItem :class="{ '!bg-on-surface-dim': isSelected(item) && !deletingAll, '!bg-accent-error': isSelected(item) && deletingAll }">
							<div>
								<InlineCollapse>
									<template #visible="{ collapsed }">
										<div class="flex h-6 items-center gap-2">
											<div v-if="deletingAll && isSelected(item)">
												<InlineSpinner></InlineSpinner>
											</div>
											<div v-else>
												<Icon v-if="isSigned(item.matrixEvent.getId())" type="seal-check" class="text-accent-blue"></Icon>
												<Icon v-else type="question" @click.stop="handleSigning(item.matrixEvent.getContent().url, item.matrixEvent.getId())" class="cursor-pointer text-on-surface-disabled"></Icon>
											</div>
											<div>
												<FileDownload :url="item.matrixEvent.getContent().url" :filename="item.matrixEvent.getContent().filename">
													<FileIcon :filename="item.matrixEvent.getContent().filename"></FileIcon>
												</FileDownload>
											</div>
											<div class="flex-grow truncate">
												<FileDownload :url="item.matrixEvent.getContent().url" :filename="item.matrixEvent.getContent().filename">{{ item.matrixEvent.getContent().filename }}</FileDownload>
											</div>
											<div>
												<InlineCollapseToggle>
													<Icon type="info" :class="{ 'text-accent-blue': !collapsed }"></Icon>
												</InlineCollapseToggle>
											</div>
											<div class="text-right max-xs:hidden">
												<span v-if="order.index <= 1" class="whitespace-nowrap ~text-label-small-min/label-small-max">
													{{ filters.formatBytes(item.matrixEvent.getContent().info?.size, 2) }}
												</span>
												<EventTimeCompact v-else-if="order.index === 2" :timestamp="item.matrixEvent.getTs()"></EventTimeCompact>
												<AvatarDisplayNameCompact
													v-else-if="order.index === 3"
													:userId="item.matrixEvent.getSender()"
													:userDisplayName="user.userDisplayName(item.matrixEvent.getSender()!)"
												></AvatarDisplayNameCompact>
											</div>
											<div>
												<FileDownload :url="item.matrixEvent.getContent().url" :filename="item.matrixEvent.getContent().filename"><IconButton type="download-simple"></IconButton></FileDownload>
											</div>
											<div v-if="user.isAdmin" class="flex items-center gap-2">
												<IconButton class="hover:text-accent-red" type="trash" @click.stop="confirmDeletion(item.matrixEvent.getContent(), item.matrixEvent.getId())"></IconButton>
												<IconButton v-if="isSelected(item)" type="check-square" @click.stop="removeFromSelection(item)"></IconButton>
												<IconButton v-else type="square" @click.stop="addToSelection(item)"></IconButton>
											</div>
										</div>
									</template>
									<template #collapsed>
										<div class="text-md flex flex-wrap items-center gap-2">
											<div class="flex flex-grow">
												<div v-if="isSigned(item.matrixEvent.getId())" class="bg-signed flex items-center gap-2 rounded-sm px-1 ~text-label-small-min/label-small-max">
													<Icon type="seal-check" class="text-accent-primary"></Icon>
													<span class="text-nowrap">{{ $t('roomlibrary.signed') }}</span>
													<DisplayNameCompact
														v-for="signedEvent in getAllSignedEventsForFile(item.matrixEvent.getId())"
														:userId="signedEvent.matrixEvent.getSender()"
														:userDisplayName="user.userDisplayName(signedEvent.matrixEvent.getSender()!)"
													></DisplayNameCompact>
												</div>
											</div>
											<div class="flex items-center ~text-label-small-min/label-small-max xs:gap-1 md:gap-2">
												<AvatarDisplayNameCompact
													v-if="item.matrixEvent.getSender()"
													:userId="item.matrixEvent.getSender()"
													:userDisplayName="user.userDisplayName(item.matrixEvent.getSender()!)"
												></AvatarDisplayNameCompact>
												<EventTimeCompact :timestamp="item.matrixEvent.getTs()"></EventTimeCompact>
											</div>
										</div>
									</template>
								</InlineCollapse>
							</div>
						</BarListItem>
					</template>
				</div>
				<BarListItem class="!mb-0 flex justify-between !bg-background">
					<span>{{ $t('roomlibrary.total_files', roomTimeLineFiles.length, { named: { count: roomTimeLineFiles.length } }) }}</span>
					<span v-if="user.isAdmin && hasSelection()">{{ $t('roomlibrary.selected_files', selection.length, { named: { count: selection.length } }) }}</span>
				</BarListItem>
			</BarList>
		</div>

		<div class="w-full max-md:order-first md:w-1/3">
			<DropFiles></DropFiles>
		</div>
	</div>

	<template v-for="item in roomTimeLine" :key="item.matrixEvent.event.event_id">
		<Dialog v-if="signingMessage && activeEventId === item.matrixEvent.event.event_id" :buttons="buttonsCancel" :title="$t('roomlibrary.sign_file_hash')" @close="signingMessage = false">
			<div class="flex flex-col items-center gap-4">
				<div class="text-center" id="yivi-web-form"></div>
				<div class="text-center">
					{{ $t('roomlibrary.sign_file_hash') }} `{{ item.matrixEvent.event.content?.filename }}` : <span class="font-bold">{{ showFileHash }}</span> <br />
					{{ $t('roomlibrary.check_file_hash') }}
				</div>
			</div>
		</Dialog>
	</template>
</template>

<script setup lang="ts">
	//Components
	import BarList from '../ui/BarList.vue';
	import BarListItem from '../ui/BarListItem.vue';
	import Dialog from '../ui/Dialog.vue';
	import DropFiles from '../ui/DropFiles.vue';
	import FileDownload from '../ui/FileDownload.vue';
	import InlineCollapse from '../ui/InlineCollapse.vue';
	// Composables
	import { computed, onMounted, onUnmounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useRoomLibrary } from '@hub-client/composables/useRoomLibrary';

	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';

	import { SortOption, SortOrder } from '@hub-client/models/components/SortOrder';
	import { YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	import { TFileMessageEventContent, TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import Room from '@hub-client/models/rooms/Room';

	import { buttonsCancel } from '@hub-client/stores/dialog';
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const dialog = useDialog();

	const emit = defineEmits(['close']);
	const { t } = useI18n();
	const rooms = useRooms();
	const user = useUser();

	const settings = useSettings();
	const pubhubs = usePubhubsStore();
	const { makeHash, deleteMedia, removeFromTimeline } = useRoomLibrary();
	const { formUrlfromMxc, deleteMediaUrlfromMxc } = useMatrixFiles();

	const signingMessage = ref<boolean>(false);
	const selectedAttributes = ref<string[]>(['irma-demo.sidn-pbdf.email.domain']);
	const activeEventId = ref<string | undefined>(undefined);
	const expandedSignedEventIds = ref<Set<string>>(new Set());
	const showFileHash = ref<string>('');
	const order = ref({ index: 0, order: SortOrder.asc } as SortOption);
	const filter = ref('');

	const selection = ref([] as Array<any>);
	const selectedAll = ref(false);
	const deletingAll = ref(false);

	const props = defineProps<{
		room: Room;
	}>();

	onMounted(() => {
		window.addEventListener('keydown', handleEsc);
	});

	onUnmounted(() => {
		window.removeEventListener('keydown', handleEsc);
		expandedSignedEventIds.value.clear();
	});

	const orderByOptions = [
		{
			key: 'name',
			name: 'roomlibrary.info.name',
			sortable: true,
			sortAsc: (a, b) => {
				if (a.matrixEvent.event.content.filename && b.matrixEvent.event.content.filename) {
					const lowA = (a.matrixEvent.event.content.filename as String).toLowerCase();
					const lowB = (b.matrixEvent.event.content.filename as String).toLowerCase();
					return lowA < lowB;
				}
				return 0;
			},
			sortDesc: (a, b) => {
				if (a.matrixEvent.event.content.filename && b.matrixEvent.event.content.filename) {
					const lowA = (a.matrixEvent.event.content.filename as String).toLowerCase();
					const lowB = (b.matrixEvent.event.content.filename as String).toLowerCase();
					return lowA > lowB;
				}
				return 0;
			},
		},
		{
			key: 'size',
			name: 'roomlibrary.info.filesize',
			sortable: true,
			sortAsc: (a, b) => a.matrixEvent.event.content?.info?.size < b.matrixEvent.event.content?.info?.size,
			sortDesc: (a, b) => a.matrixEvent.event.content?.info?.size > b.matrixEvent.event.content?.info?.size,
		},
		{
			key: 'date',
			name: 'roomlibrary.info.filedate',
			sortable: true,
			sortAsc: (a, b) => a.matrixEvent.event.origin_server_ts < b.matrixEvent.event.origin_server_ts,
			sortDesc: (a, b) => a.matrixEvent.event.origin_server_ts > b.matrixEvent.event.origin_server_ts,
		},
		{
			key: 'user',
			name: 'roomlibrary.info.user',
			sortable: true,
			sortAsc: (a, b) => a.matrixEvent.event.sender < b.matrixEvent.event.sender,
			sortDesc: (a, b) => a.matrixEvent.event.sender > b.matrixEvent.event.sender,
		},
	];
	const orderByOptionsNames = orderByOptions.map((item) => {
		return item.name;
	});

	const roomTimeLine = computed(() => {
		let timeline = props.room.getLibraryTimeline().filter(
			(e) =>
				e.matrixEvent.event !== null &&
				e.matrixEvent.event.content &&
				Object.keys(e.matrixEvent.event.content).length > 0 &&
				// e.matrixEvent.event.type !== Redaction.DeletedFromLibrary &&
				// e.matrixEvent.event.type !== Redaction.Redacts &&
				e.isDeleted === false,
		);
		// filter
		if (filter.value !== '') {
			timeline = timeline.filter((e) => {
				const lowerFilter = filter.value.toLocaleLowerCase();
				if (e.matrixEvent.event.content?.filename) {
					const filename = (e.matrixEvent.event.content.filename as String).toLocaleLowerCase();
					return filename.indexOf(lowerFilter) >= 0;
				}
				return false;
			});
		}
		// order
		if (order.value.index >= 0) {
			let func = orderByOptions[order.value.index].sortAsc;
			if (order.value.order == SortOrder.desc) {
				func = orderByOptions[order.value.index].sortDesc;
			}
			timeline = timeline.sort(func);
		}
		return timeline;
	});

	const roomTimeLineFiles = computed(() => {
		return roomTimeLine.value.filter((e) => e.matrixEvent.getContent().msgtype === 'm.file' || e.matrixEvent.getContent().msgtype === 'm.image');
	});

	const setOrderBy = (o: SortOption) => {
		order.value = o;
	};

	const getAllSignedEventsForFile = (eventId: string | undefined) => {
		// Get all signed events for the given file (using the event_id to match the related 'original' file event)
		if (roomTimeLine.value) {
			const signed = roomTimeLine.value.filter((e) => {
				return e.matrixEvent.event.content?.msgtype === PubHubsMgType.SignedFileMessage && e.matrixEvent.event.content?.['m.relates_to']?.event_id === eventId;
			});
			return signed;
		}
		return [];
	};

	const isSigned = (eventId: string | undefined) => {
		return getAllSignedEventsForFile(eventId).length > 0;
	};

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
			const hashedFile = await makeHash(accessToken, url, props.room);
			showFileHash.value = hashedFile;
			rooms.yiviSignMessage(hashedFile, selectedAttributes.value, rooms.currentRoomId, undefined, finishedSigningMessage);
		}
	}

	async function finishedSigningMessage(result: YiviSigningSessionResult) {
		signingMessage.value = false;
		await pubhubs.addSignedFile(rooms.currentRoomId, result, activeEventId.value);
	}

	async function confirmDeletion(eventContent: TFileMessageEventContent | TImageMessageEventContent, eventId: string | undefined) {
		const confirm = await dialog.okcancel(t('roomlibrary.delete.heading'), t('roomlibrary.delete.content', [eventContent.filename]));
		if (confirm) {
			await handleDeletion(eventContent, eventId as string);
		}
	}

	async function handleDeletion(eventContent: TFileMessageEventContent | TImageMessageEventContent | undefined, eventId: string) {
		if (eventContent) {
			const mxc = eventContent.url;
			const url = deleteMediaUrlfromMxc(mxc);
			const allSignedEvents = getAllSignedEventsForFile(eventId);
			await deleteMedia(url, eventId, props.room.roomId);
			await removeFromTimeline(eventId, props.room.roomId, allSignedEvents);
		}
	}

	function hasSelection() {
		return selection.value.length > 0;
	}

	function addToSelection(item: any) {
		if (!isSelected(item)) {
			selection.value.push(item);
		}
	}

	function selectAll(all: Array<any>) {
		selectedAll.value = true;
		all.forEach((item) => {
			addToSelection(item);
		});
	}

	function unselectAll() {
		selectedAll.value = false;
		selection.value = [];
	}

	function isSelected(item: any) {
		return selection.value.includes(item);
	}

	function removeFromSelection(item: any) {
		const index = selection.value.findIndex((e) => e === item);
		selection.value.splice(index, 1);
	}

	async function deleteSelected() {
		const confirm = await dialog.okcancel(t('roomlibrary.delete.multiple_heading'), t('roomlibrary.delete.multiple_content', [selection.value.length]));
		if (confirm) {
			filter.value = '';
			deletingAll.value = true;
			await Promise.all(
				selection.value.map(async (item) => {
					await handleDeletion(item.matrixEvent.event.content, item.matrixEvent.event.event_id);
				}),
			);
			deletingAll.value = false;
			unselectAll();
		}
	}
</script>
