<template>
	<div class="flex h-full w-full flex-col py-4">
		<SidebarHeader :title="t('roomlibrary.library')" />
		<div class="flex flex-1 flex-col gap-4 overflow-auto px-4">
			<!-- Upload area -->
			<div class="w-full">
				<DropFiles />
			</div>

			<!-- Search and sort -->
			<div class="w-full">
				<div class="mb-4 flex w-full gap-4">
					<div class="bg-surface-high flex w-1/2 items-center gap-2 rounded-md px-3 py-2 sm:w-3/4">
						<Icon
							class="text-on-surface-dim"
							size="sm"
							type="magnifying-glass"
						/>
						<input
							v-model="filter"
							class="text-label-small placeholder:text-on-surface-variant w-full border-none bg-transparent focus:ring-0 focus:outline-0"
							:placeholder="t('others.search')"
							role="searchbox"
							:title="t('others.search')"
							type="text"
						/>
					</div>
					<div class="flex w-1/2 sm:w-1/4">
						<PullDownMenu
							:options="orderByOptionsNames"
							:selected="order"
							:title="t('roomlibrary.info.sortby')"
							:toggle-order="true"
							@select="setOrderBy($event)"
						/>
					</div>
				</div>

				<BarList
					v-if="roomTimeLineFiles.length > 0"
					class="max-h-fit"
					data-testid="filemanager"
				>
					<BarListItem
						v-if="user.isAdmin"
						class="bg-background! mb-0! flex justify-end"
						data-testid="filemanager-admin"
					>
						<div class="flex items-center gap-1">
							<IconButton
								v-if="hasSelection()"
								class="hover:text-accent-red"
								type="trash"
								@click.stop="deleteSelected()"
							/>
							<IconButton
								v-if="!selectedAll"
								type="square"
								@click.stop="selectAll(roomTimeLineFiles)"
							/>
							<IconButton
								v-else
								type="check-square"
								@click.stop="unselectAll()"
							/>
						</div>
					</BarListItem>
					<div data-testid="filemanager-list">
						<template
							v-for="item in roomTimeLineFiles"
							:key="item.matrixEvent.getId()"
						>
							<BarListItem
								:class="{ 'bg-on-surface-dim!': isSelected(item) && !deletingAll, 'bg-accent-error!': isSelected(item) && deletingAll }"
							>
								<div>
									<InlineCollapse>
										<template #visible="{ collapsed }">
											<div class="flex h-6 items-center gap-2">
												<div v-if="deletingAll && isSelected(item)">
													<InlineSpinner />
												</div>
												<div v-else>
													<Icon
														v-if="isSigned(item.matrixEvent.getId())"
														class="text-accent-blue"
														type="seal-check"
													/>
													<Icon
														v-else
														class="text-on-surface-disabled cursor-pointer"
														type="question"
														@click.stop="handleSigning(item.matrixEvent.getContent().url, item.matrixEvent.getId())"
													/>
												</div>
												<div>
													<FileDownload
														:filename="item.matrixEvent.getContent().filename"
														:url="item.matrixEvent.getContent().url"
													>
														<FileIcon :filename="item.matrixEvent.getContent().filename" />
													</FileDownload>
												</div>
												<div class="grow truncate">
													<FileDownload
														:filename="item.matrixEvent.getContent().filename"
														:url="item.matrixEvent.getContent().url"
													>
														{{ item.matrixEvent.getContent().filename }}
													</FileDownload>
												</div>
												<div>
													<InlineCollapseToggle>
														<Icon
															:class="{ 'text-accent-blue': !collapsed }"
															type="info"
														/>
													</InlineCollapseToggle>
												</div>
												<div class="max-xs:hidden text-right">
													<span
														v-if="order.index <= 1"
														class="text-label-small whitespace-nowrap"
													>
														{{ filters.formatBytes(item.matrixEvent.getContent().info?.size, 2) }}
													</span>
													<EventTimeCompact
														v-else-if="order.index === 2"
														:timestamp="item.matrixEvent.getTs()"
													/>
													<AvatarDisplayNameCompact
														v-else-if="order.index === 3"
														:user-display-name="user.userDisplayName(item.matrixEvent.getSender() ?? '')"
														:user-id="item.matrixEvent.getSender()"
													/>
												</div>
												<div>
													<FileDownload
														:filename="item.matrixEvent.getContent().filename"
														:url="item.matrixEvent.getContent().url"
													>
														<IconButton type="download-simple" />
													</FileDownload>
												</div>
												<div
													v-if="user.isAdmin"
													class="flex items-center gap-2"
												>
													<IconButton
														class="hover:text-accent-red"
														type="trash"
														@click.stop="confirmDeletion(item.matrixEvent.getContent(), item.matrixEvent.getId())"
													/>
													<IconButton
														v-if="isSelected(item)"
														type="check-square"
														@click.stop="removeFromSelection(item)"
													/>
													<IconButton
														v-else
														type="square"
														@click.stop="addToSelection(item)"
													/>
												</div>
											</div>
										</template>
										<template #collapsed>
											<div class="text-md flex flex-wrap items-center gap-2">
												<div class="flex grow">
													<div
														v-if="isSigned(item.matrixEvent.getId())"
														class="bg-signed text-label-small flex items-center gap-2 rounded-xs px-1"
													>
														<Icon
															class="text-accent-primary"
															type="seal-check"
														/>
														<span class="text-nowrap">{{ $t('roomlibrary.signed') }}</span>
														<DisplayNameCompact
															v-for="signedEvent in getAllSignedEventsForFile(item.matrixEvent.getId())"
															:key="signedEvent.matrixEvent.getId()"
															:user-display-name="user.userDisplayName(signedEvent.matrixEvent.getSender() ?? '')"
															:user-id="signedEvent.matrixEvent.getSender()"
														/>
													</div>
												</div>
												<div class="text-label-small xs:gap-1 flex items-center md:gap-2">
													<AvatarDisplayNameCompact
														v-if="item.matrixEvent.getSender()"
														:user-display-name="user.userDisplayName(item.matrixEvent.getSender() ?? '')"
														:user-id="item.matrixEvent.getSender()"
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
					<BarListItem class="bg-background! mb-0! flex justify-between">
						<span>{{ $t('roomlibrary.total_files', roomTimeLineFiles.length, { named: { count: roomTimeLineFiles.length } }) }}</span>
						<span v-if="user.isAdmin && hasSelection()">{{
							$t('roomlibrary.selected_files', selection.length, { named: { count: selection.length } })
						}}</span>
					</BarListItem>
				</BarList>
			</div>
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
			@close="signingMessage = false"
		>
			<div class="flex flex-col items-center gap-4">
				<div
					:id="EYiviFlow.Sign"
					class="text-center"
				/>
				<div class="text-center">
					{{ $t('roomlibrary.sign_file_hash') }} `{{ item.matrixEvent.event.content?.filename }}` : <span class="font-bold">{{ showFileHash }}</span>
					<br />
					{{ $t('roomlibrary.check_file_hash') }}
				</div>
			</div>
		</Dialog>
	</template>
</template>

<script lang="ts" setup>
	//Components
	import BarList from '../ui/BarList.vue';
	import BarListItem from '../ui/BarListItem.vue';
	import Dialog from '../ui/Dialog.vue';
	import DropFiles from '../ui/DropFiles.vue';
	import FileDownload from '../ui/FileDownload.vue';
	import InlineCollapse from '../ui/InlineCollapse.vue';
	import SidebarHeader from '../ui/SidebarHeader.vue';
	import type { Room as MatrixRoom } from 'matrix-js-sdk';
	// Composables
	import { computed, onMounted, onUnmounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useRoomLibrary } from '@hub-client/composables/useRoomLibrary';

	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';
	import { yiviFlow } from '@hub-client/logic/yiviHandler';

	import { type SortOption, SortOrder } from '@hub-client/models/components/SortOrder';
	import { type YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	import { type TFileMessageEventContent, type TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import type Room from '@hub-client/models/rooms/Room';
	import { EYiviFlow, type SecuredRoomAttributeResult } from '@hub-client/models/yivi/Tyivi';

	import { buttonsCancel } from '@hub-client/stores/dialog';
	import { useDialog } from '@hub-client/stores/dialog';
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

	const _settings = useSettings();
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

	const selection = ref([] as Array<TimelineEvent>);
	const selectedAll = ref(false);
	const deletingAll = ref(false);

	onMounted(() => {
		window.addEventListener('keydown', handleEsc);
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
					const filename = (e.matrixEvent.event.content.filename as string).toLocaleLowerCase();
					return filename.indexOf(lowerFilter) >= 0;
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
			await deleteMedia(url, eventId, props.room.roomId);
			await removeFromTimeline(
				eventId,
				props.room.roomId,
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
		const index = (selection.value as unknown as TimelineEvent[]).findIndex((e) => e === item);
		selection.value.splice(index, 1);
	}

	async function deleteSelected() {
		const confirm = await dialog.okcancel(t('roomlibrary.delete.multiple_heading'), t('roomlibrary.delete.multiple_content', [selection.value.length]));
		if (confirm) {
			filter.value = '';
			deletingAll.value = true;
			await Promise.all(
				selection.value.map(async (item) => {
					await handleDeletion(
						item.matrixEvent.event.content as TFileMessageEventContent | TImageMessageEventContent | undefined,
						item.matrixEvent.event.event_id ?? '',
					);
				}),
			);
			deletingAll.value = false;
			unselectAll();
		}
	}
</script>
