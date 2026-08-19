<template>
	<div class="flex h-full w-full flex-col py-200">
		<SidebarHeader :title="t('roomlibrary.library')" />
		<div class="flex flex-1 flex-col overflow-hidden px-200">
			<!-- Top: upload area + search/sort (fixed) -->
			<div class="flex shrink-0 flex-col gap-200">
				<!-- Upload area -->
				<div class="w-full">
					<DropFiles
						:max-number-of-files="SystemDefaults.maxLibraryFiles"
						:current-file-names="roomTimeLineFiles.map((x) => x.matrixEvent.event.content?.filename)"
					/>
				</div>

				<!-- Search and sort -->
				<div class="w-full">
					<div class="mb-200 flex w-full gap-200">
						<div class="bg-surface-sunken flex w-2/3 items-center gap-100 rounded-md px-150 py-100">
							<Icon
								class="text-on-surface-dim"
								size="sm"
								type="magnifying-glass"
							/>
							<input
								v-model="filter"
								class="text-label-small placeholder:text-on-surface-dim w-full border-none bg-transparent focus:ring-0 focus:outline-0"
								:placeholder="t('others.search')"
								role="searchbox"
								:title="t('others.search')"
								type="text"
							/>
						</div>
						<div class="flex w-1/3">
							<PullDownMenu
								:options="orderByOptionsNames"
								:selected="order"
								:title="t('roomlibrary.info.sortby')"
								:toggle-order="true"
								@select="setOrderBy($event)"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Scrollable file list + pinned footer -->
			<template v-if="roomTimeLineFiles.length > 0">
				<div class="flex flex-1 flex-col overflow-hidden">
					<BarList
						class="flex flex-1 flex-col overflow-hidden"
						data-testid="filemanager"
					>
						<BarListItem
							v-if="user.isAdmin"
							class="bg-background! mb-0! flex shrink-0"
							data-testid="filemanager-admin"
						>
							<div class="gap-050 flex items-center">
								<IconButton
									v-if="!selectedAll"
									icon="square"
									size="sm"
									variant="secondary"
									@click.stop="selectAll(roomTimeLineFiles)"
								/>
								<IconButton
									v-else
									icon="check-square"
									size="sm"
									variant="secondary"
									@click.stop="unselectAll()"
								/>
								<IconButton
									v-if="hasSelection()"
									class="hover:text-accent-red"
									icon="trash"
									size="sm"
									variant="secondary"
									@click.stop="deleteSelected()"
								/>
							</div>
						</BarListItem>
						<div
							class="flex-1 overflow-y-auto"
							data-testid="filemanager-list"
						>
							<template
								v-for="item in roomTimeLineFiles"
								:key="item.matrixEvent.getId()"
							>
								<BarListItem :class="{ 'bg-accent-error!': isSelected(item) && deletingAll }">
									<div>
										<InlineCollapse>
											<template #visible="{ collapsed, toggle }">
												<div
													v-context-menu="(evt: any) => openMenu(evt, contextMenuItems(item, toggle), item.matrixEvent.getId())"
													class="gap-050 flex h-300 cursor-pointer items-center"
													:class="{
														'bg-surface-elevated!': contextMenu.isOpen && contextMenu.currentTargetId === item.matrixEvent.getId(),
													}"
													:title="t('menu.download_file')"
													@click.capture="suppressClickAfterLongPress"
													@click="downloadItem(item)"
												>
													<div
														v-if="user.isAdmin"
														class="gap-050 flex items-center"
														@click.stop
													>
														<IconButton
															v-if="isSelected(item)"
															icon="check-square"
															size="sm"
															variant="secondary"
															@click.stop="removeFromSelection(item)"
														/>
														<IconButton
															v-else
															icon="square"
															variant="secondary"
															size="sm"
															@click.stop="addToSelection(item)"
														/>
													</div>
													<div v-if="(deletingAll && isSelected(item)) || isDownloading(item.matrixEvent.getContent().url)">
														<InlineSpinner />
													</div>
													<div v-else>
														<FileIcon :filename="item.matrixEvent.getContent().filename" />
													</div>
													<button
														:aria-label="`${t('menu.download_file')}: ${item.matrixEvent.getContent().filename}`"
														class="text-label-small min-w-0 grow cursor-pointer truncate text-left"
														:title="item.matrixEvent.getContent().filename"
														type="button"
														@click.stop="downloadItem(item)"
													>
														{{ item.matrixEvent.getContent().filename }}
													</button>
													<div
														v-if="isSigned(item.matrixEvent.getId())"
														:title="t('roomlibrary.info.sign')"
													>
														<Icon
															class="text-accent-blue"
															type="seal-check"
															size="sm"
														/>
													</div>
													<IconButton
														data-testid="filemanager-share"
														icon="paper-plane-right"
														size="sm"
														:title="t('roomlibrary.share_to_timeline')"
														variant="secondary"
														@click.stop="shareItem(item)"
													/>
													<div class="max-xs:hidden flex min-w-500 justify-end overflow-hidden text-right">
														<span
															v-if="order.index <= 1"
															class="text-label-tiny whitespace-nowrap"
														>
															{{ filters.formatBytes(item.matrixEvent.getContent().info?.size, 0) }}
														</span>
														<EventTimeCompact
															v-else-if="order.index === 2"
															:timestamp="item.matrixEvent.getTs()"
														/>
														<AvatarDisplayNameCompact
															v-else-if="order.index === 3"
															class="text-label-small text-nowrap"
															:user-display-name="user.userDisplayName(item.matrixEvent.getSender() ?? '')"
															:user-id="item.matrixEvent.getSender()!"
														/>
													</div>
													<!-- Marks the row whose details panel is open; the panel is toggled from the context menu -->
													<Icon
														v-if="!collapsed"
														class="text-accent-blue"
														type="info"
														size="sm"
													/>
												</div>
											</template>
											<template #collapsed>
												<div class="text-md flex flex-wrap items-center gap-100">
													<div class="flex grow">
														<div
															v-if="isSigned(item.matrixEvent.getId())"
															class="bg-signed text-label-small px-050 flex items-center gap-100 rounded-xs"
														>
															<Icon
																class="text-accent-primary"
																type="seal-check"
																size="sm"
															/>
															<span class="text-nowrap">{{ $t('roomlibrary.signed') }}</span>
															<DisplayNameCompact
																v-for="signedEvent in getAllSignedEventsForFile(item.matrixEvent.getId())"
																:key="signedEvent.matrixEvent.getId()"
																:user-display-name="user.userDisplayName(signedEvent.matrixEvent.getSender() ?? '')"
																:user-id="signedEvent.matrixEvent.getSender()!"
															/>
														</div>
													</div>
													<div class="text-label-small xs:gap-050 flex items-center md:gap-100">
														<AvatarDisplayNameCompact
															v-if="item.matrixEvent.getSender()"
															:user-display-name="user.userDisplayName(item.matrixEvent.getSender() ?? '')"
															:user-id="item.matrixEvent.getSender()!"
														/>
														<EventTimeCompact :timestamp="item.matrixEvent.getTs()" />
													</div>
												</div>
											</template>
										</InlineCollapse>
									</div>
								</BarListItem>
							</template>
						</div>
						<BarListItem class="bg-background! mb-0! flex shrink-0 justify-between">
							<span>{{ $t('roomlibrary.total_files', roomTimeLineFiles.length, { named: { count: roomTimeLineFiles.length } }) }}</span>
							<span v-if="user.isAdmin && hasSelection()">{{
								$t('roomlibrary.selected_files', selection.length, { named: { count: selection.length } })
							}}</span>
						</BarListItem>
					</BarList>
				</div>
			</template>
		</div>
	</div>

	<template
		v-for="item in roomTimeLine"
		:key="item.matrixEvent.event.event_id"
	>
		<Dialog
			v-if="signingMessage && activeEventId === item.matrixEvent.event.event_id"
			:buttons="buttonsCancel"
			:title="$t('roomlibrary.sign_file_hash')"
			:width="isMobile ? 'px-400 w-full' : 'w-[600px] px-400'"
			@close="signingMessage = false"
		>
			<div class="flex flex-col items-center gap-200">
				<div
					:id="EYiviFlow.Sign"
					class="text-center"
				/>
				<div class="text-center">
					{{ $t('roomlibrary.sign_file_hash') }} `<span class="italic">{{ item.matrixEvent.event.content?.filename }}`</span> :
					<div class="bg-accent-secondary mt-150 rounded-md border p-100 font-bold wrap-anywhere text-black">{{ showFileHash }}</div>
					<br />
					{{ $t('roomlibrary.check_file_hash') }}
				</div>
			</div>
		</Dialog>
	</template>
</template>

<script lang="ts" setup>
	// Packages
	import { type Room as MatrixRoom, MsgType } from 'matrix-js-sdk';
	import { computed, onMounted, onUnmounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import AvatarDisplayNameCompact from '@hub-client/components/rooms/AvatarDisplayNameCompact.vue';
	import DisplayNameCompact from '@hub-client/components/rooms/DisplayNameCompact.vue';
	import EventTimeCompact from '@hub-client/components/rooms/EventTimeCompact.vue';
	import BarList from '@hub-client/components/ui/BarList.vue';
	import BarListItem from '@hub-client/components/ui/BarListItem.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import DropFiles from '@hub-client/components/ui/DropFiles.vue';
	import FileIcon from '@hub-client/components/ui/FileIcon.vue';
	import InlineCollapse from '@hub-client/components/ui/InlineCollapse.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import PullDownMenu from '@hub-client/components/ui/PullDownMenu.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useFileDownload } from '@hub-client/composables/useFileDownload';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useRoomLibrary } from '@hub-client/composables/useRoomLibrary';
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';
	import { yiviFlow } from '@hub-client/logic/yiviHandler';

	// Models
	import { type SortOption, SortOrder } from '@hub-client/models/components/SortOrder';
	import { ContextVariant, type MenuItem } from '@hub-client/models/components/contextMenu.models';
	import { type YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	import { SystemDefaults } from '@hub-client/models/constants';
	import { type TFileMessageEventContent, type TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import type Room from '@hub-client/models/rooms/Room';
	import { EYiviFlow, type SecuredRoomAttributeResult } from '@hub-client/models/yivi/Tyivi';

	// Stores
	import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
	import { buttonsCancel, useDialog } from '@hub-client/stores/dialog';
	import { useMessageActions } from '@hub-client/stores/message-actions';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		room: Room;
	}>();

	const dialog = useDialog();
	const { t } = useI18n();
	const rooms = useRooms();
	const user = useUser();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const pubhubs = usePubhubsStore();
	const messageActions = useMessageActions();
	const contextMenu = useContextMenuStore();
	const sidebar = useSidebar();
	const { openMenu } = useContextMenu();
	const { makeHash, deleteMedia, removeFromTimeline } = useRoomLibrary();
	const { formUrlfromMxc, deleteMediaUrlfromMxc } = useMatrixFiles();
	const { downloadFile, isDownloading } = useFileDownload();

	const signingMessage = ref<boolean>(false);
	const selectedAttributes = ref<string[]>(['irma-demo.sidn-pbdf.email.domain']);
	const activeEventId = ref<string | undefined>(undefined);
	const expandedSignedEventIds = ref<Set<string>>(new Set());
	const showFileHash = ref<string>('');
	const order = ref({ index: 0, order: SortOrder.asc } as SortOption);
	const filter = ref('');

	const selection = ref([] as Array<TimelineEvent>);
	const selectedAll = ref(false);
	const deletingAll = ref(false);
	const libraryVersion = ref(0);

	onMounted(() => {
		window.addEventListener('keydown', handleEsc);
		props.room.initFileLibrary();
	});

	onUnmounted(() => {
		window.removeEventListener('keydown', handleEsc);
		expandedSignedEventIds.value.clear();
	});

	const orderByOptions: Array<{
		key: string;
		name: string;
		sortable: boolean;
		sortAsc: (a: TimelineEvent, b: TimelineEvent) => number;
		sortDesc: (a: TimelineEvent, b: TimelineEvent) => number;
	}> = [
		{
			key: 'name',
			name: 'roomlibrary.info.name',
			sortable: true,
			sortAsc: (a, b) => {
				if (a.matrixEvent.event.content?.filename && b.matrixEvent.event.content?.filename) {
					const lowA = (a.matrixEvent.event.content.filename as string).toLowerCase();
					const lowB = (b.matrixEvent.event.content.filename as string).toLowerCase();
					return lowA < lowB ? -1 : lowA > lowB ? 1 : 0;
				}
				return 0;
			},
			sortDesc: (a, b) => {
				if (a.matrixEvent.event.content?.filename && b.matrixEvent.event.content?.filename) {
					const lowA = (a.matrixEvent.event.content.filename as string).toLowerCase();
					const lowB = (b.matrixEvent.event.content.filename as string).toLowerCase();
					return lowA > lowB ? -1 : lowA < lowB ? 1 : 0;
				}
				return 0;
			},
		},
		{
			key: 'size',
			name: 'roomlibrary.info.filesize',
			sortable: true,
			sortAsc: (a, b) => ((a.matrixEvent.event.content?.info?.size as number) ?? 0) - ((b.matrixEvent.event.content?.info?.size as number) ?? 0),
			sortDesc: (a, b) => ((b.matrixEvent.event.content?.info?.size as number) ?? 0) - ((a.matrixEvent.event.content?.info?.size as number) ?? 0),
		},
		{
			key: 'date',
			name: 'roomlibrary.info.filedate',
			sortable: true,
			sortAsc: (a, b) => (a.matrixEvent.event.origin_server_ts ?? 0) - (b.matrixEvent.event.origin_server_ts ?? 0),
			sortDesc: (a, b) => (b.matrixEvent.event.origin_server_ts ?? 0) - (a.matrixEvent.event.origin_server_ts ?? 0),
		},
		{
			key: 'user',
			name: 'roomlibrary.info.user',
			sortable: true,
			sortAsc: (a, b) => (a.matrixEvent.event.sender ?? '').localeCompare(b.matrixEvent.event.sender ?? ''),
			sortDesc: (a, b) => (b.matrixEvent.event.sender ?? '').localeCompare(a.matrixEvent.event.sender ?? ''),
		},
	];
	const orderByOptionsNames = orderByOptions.map((item) => {
		return item.name;
	});

	const roomTimeLine = computed(() => {
		// Access libraryVersion to trigger re-computation when files are deleted
		void libraryVersion.value;
		let timeline = props.room
			.getLibraryTimeline()
			.filter(
				(e) =>
					e.matrixEvent.event !== null && e.matrixEvent.event.content && Object.keys(e.matrixEvent.event.content).length > 0 && e.isDeleted === false,
			);
		// filter
		if (filter.value !== '') {
			timeline = timeline.filter((e) => {
				const lowerFilter = filter.value.toLocaleLowerCase();
				if (e.matrixEvent.event.content?.filename) {
					const filename = (e.matrixEvent.event.content.filename as string).toLocaleLowerCase();
					return filename.includes(lowerFilter);
				}
				return false;
			});
		}
		// order
		if (order.value.index >= 0) {
			let func = orderByOptions[order.value.index].sortAsc;
			if (order.value.order === SortOrder.desc) {
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
				return (
					e.matrixEvent.event.content?.msgtype === PubHubsMgType.SignedFileMessage &&
					e.matrixEvent.event.content?.['m.relates_to']?.event_id === eventId
				);
			});
			return signed;
		}
		return [];
	};

	const isSigned = (eventId: string | undefined) => {
		return getAllSignedEventsForFile(eventId).length > 0;
	};

	/**
	 * Actions that do not fit next to the file name live in the right click (or long press) menu.
	 * @param toggle Opens and closes the details panel of this file, provided by the surrounding InlineCollapse
	 */
	function contextMenuItems(item: TimelineEvent, toggle: () => void): MenuItem[] {
		const eventId = item.matrixEvent.getId();
		const items: MenuItem[] = [
			{ label: t('menu.download_file'), icon: 'download-simple', onClick: () => downloadItem(item) },
			{ label: t('roomlibrary.share_to_timeline'), icon: 'paper-plane-right', onClick: () => shareItem(item) },
			{ label: t('roomlibrary.file_details'), icon: 'info', onClick: () => toggle() },
		];
		if (!isSigned(eventId)) {
			items.push({
				label: t('roomlibrary.sign_file'),
				icon: 'pen-nib',
				onClick: () => handleSigning(item.matrixEvent.getContent().url, eventId),
			});
		}
		if (user.isAdmin) {
			items.push(
				{ divider: true, label: '' },
				{
					label: t('roomlibrary.delete_file'),
					icon: 'trash',
					variant: ContextVariant.delicate,
					onClick: () => confirmDeletion(item.matrixEvent.getContent(), eventId),
				},
			);
		}
		return items;
	}

	/**
	 * A long press opens the context menu, but the browser still fires a click when the finger is lifted.
	 * This functions stops propogation after the context menu has been opened.
	 */
	function suppressClickAfterLongPress(event: MouseEvent) {
		// Immediate: the row listens for clicks on itself as well, and that listener has to be stopped too.
		if (contextMenu.isOpen) event.stopImmediatePropagation();
	}

	async function downloadItem(item: TimelineEvent) {
		const content = item.matrixEvent.getContent();
		const succeeded = await downloadFile(content.url, content.filename ?? content.body ?? 'file');
		if (!succeeded) {
			dialog.confirm(t('errors.file_download'));
		}
	}

	/**
	 * Hands the file to the message input, so the user can add a message before posting it in the timeline.
	 * The file stays where it is on the media server: nothing is uploaded again.
	 */
	function shareItem(item: TimelineEvent) {
		const content = item.matrixEvent.getContent();
		messageActions.sharingFile = {
			mxcUrl: content.url,
			filename: content.filename ?? content.body ?? 'file',
			mimetype: content.info?.mimetype,
			size: content.info?.size,
			msgtype: content.msgtype === MsgType.Image ? MsgType.Image : MsgType.File,
		};
		// On mobile the sidebar covers the message input, so make room for the file that was just attached.
		if (isMobile.value && sidebar.activeTab.value === SidebarTab.Library) {
			sidebar.close();
		}
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
			const hashedFile = await makeHash(accessToken, url, props.room as unknown as MatrixRoom);
			showFileHash.value = hashedFile;
			yiviFlow(EYiviFlow.Sign, finishedSigningMessage, rooms.currentRoomId ?? '', '#' + EYiviFlow.Sign, selectedAttributes.value, hashedFile);
		}
	}

	async function finishedSigningMessage(result: YiviSigningSessionResult | SecuredRoomAttributeResult) {
		signingMessage.value = false;
		await pubhubs.addSignedFile(rooms.currentRoomId ?? '', result as YiviSigningSessionResult, activeEventId.value);
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

			// Hide file from UI immediately (before API calls that may have rate limiting delays)
			props.room.removeLibraryEvent(eventId);
			for (const signedEvent of allSignedEvents) {
				const signedEventId = signedEvent.matrixEvent.getId();
				if (signedEventId) {
					props.room.removeLibraryEvent(signedEventId);
				}
			}
			libraryVersion.value++;

			// Process deletion in background (may take time due to rate limiting)
			await deleteMedia(url, eventId, props.room.roomId);
			await removeFromTimeline(
				props.room,
				eventId,
				allSignedEvents.map((e) => e.matrixEvent),
			);
		}
	}

	function hasSelection() {
		return selection.value.length > 0;
	}

	function addToSelection(item: TimelineEvent) {
		if (!isSelected(item)) {
			(selection.value as unknown as TimelineEvent[]).push(item);
		}
	}

	function selectAll(all: Array<TimelineEvent>) {
		selectedAll.value = true;
		all.forEach((item) => {
			addToSelection(item);
		});
	}

	function unselectAll() {
		selectedAll.value = false;
		selection.value = [];
	}

	function isSelected(item: TimelineEvent) {
		return (selection.value as unknown as TimelineEvent[]).includes(item);
	}

	function removeFromSelection(item: TimelineEvent) {
		const index = (selection.value as unknown as TimelineEvent[]).indexOf(item);
		selection.value.splice(index, 1);
	}

	async function deleteSelected() {
		const confirm = await dialog.okcancel(t('roomlibrary.delete.multiple_heading'), t('roomlibrary.delete.multiple_content', [selection.value.length]));
		if (confirm) {
			filter.value = '';
			deletingAll.value = true;
			// Delete files sequentially to avoid rate limiting
			for (const item of selection.value) {
				await handleDeletion(
					item.matrixEvent.event.content as TFileMessageEventContent | TImageMessageEventContent | undefined,
					item.matrixEvent.event.event_id ?? '',
				);
			}
			deletingAll.value = false;
			unselectAll();
		}
	}
</script>
