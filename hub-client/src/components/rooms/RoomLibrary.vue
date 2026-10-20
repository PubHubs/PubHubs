<template>
	<div
		class="relative flex h-full w-full flex-col py-200"
		@dragenter="onDragEnter"
		@dragleave="onDragLeave"
		@dragover.prevent
		@drop.prevent="onDrop"
	>
		<SidebarHeader :title="selectedFile ? t('roomlibrary.file_details') : t('roomlibrary.library')" />

		<LibraryFileDetails
			v-if="selectedFile"
			:actions="detailActions(selectedFile)"
			:item="selectedFile"
			:signatures="signaturesOf(selectedFile)"
			@back="selectedFileId = null"
		/>

		<!-- v-show keeps the scroll position; min-h-0 instead of overflow-hidden, which clips the search focus ring -->
		<div
			v-show="!selectedFile"
			class="flex min-h-0 flex-1 flex-col"
		>
			<!-- Toolbar -->
			<div class="flex shrink-0 items-center gap-100 px-200 pb-200">
				<SidebarSearchField
					v-model="filter"
					class="min-w-0 grow"
					:placeholder="t('roomlibrary.search')"
				/>
				<input
					ref="fileInput"
					class="hidden"
					data-testid="library-file-input"
					multiple
					type="file"
					@change="onFilesPicked"
				/>
			</div>

			<!-- Sort -->
			<div
				v-if="files.length > 1"
				class="flex shrink-0 px-200 pb-100"
			>
				<button
					:aria-label="`${t('roomlibrary.sort.label')}: ${t(`roomlibrary.sort.${sortOrder}`)}`"
					class="text-label-small text-on-surface-dim hover:text-on-surface hover:bg-surface-elevated rounded-base gap-050 py-050 outline-accent-blue-interactive flex cursor-pointer items-center px-100 transition-colors focus-visible:outline-3"
					:class="touchTarget"
					data-testid="library-sort"
					type="button"
					@click.stop="openMenu($event, sortMenuItems(), 'library-sort')"
				>
					<Icon
						size="sm"
						type="arrows-down-up"
					/>
					<span>{{ t(`roomlibrary.sort.${sortOrder}`) }}</span>
					<Icon
						size="sm"
						type="caret-down"
					/>
				</button>
			</div>

			<!-- List -->
			<div class="relative flex flex-1 flex-col overflow-hidden">
				<div
					:aria-busy="isLoading"
					class="flex flex-1 flex-col gap-100 overflow-y-auto px-200 pb-800"
					data-testid="filemanager-list"
				>
					<template v-if="isLoading && files.length === 0">
						<p
							class="sr-only"
							role="status"
						>
							{{ t('common.loading') }}
						</p>
						<!-- Loading placeholders, same height as the file rows -->
						<ul
							aria-hidden="true"
							class="gap-050 flex flex-col"
							data-testid="filemanager-loading"
						>
							<li
								v-for="n in 4"
								:key="n"
								class="rounded-base flex animate-pulse items-center gap-100 p-100"
							>
								<div class="bg-surface-elevated rounded-base h-200 w-200 shrink-0" />
								<!-- 1.3em is the label line height -->
								<div class="flex min-w-0 grow flex-col">
									<div class="text-label-small bg-surface-elevated rounded-base h-[1.3em] w-2/3 scale-y-75" />
									<div class="text-label-tiny bg-surface-elevated rounded-base h-[1.3em] w-1/2 scale-y-75" />
								</div>
							</li>
						</ul>
					</template>
					<template v-else>
						<!-- Uploads -->
						<ul
							v-if="uploads.length > 0"
							class="gap-050 flex flex-col"
							data-testid="file-list"
						>
							<li
								v-for="upload in uploads"
								:key="upload.id"
								class="gap-050 rounded-base flex flex-col p-100"
							>
								<div class="flex items-center gap-100 pointer-coarse:gap-200">
									<FileIcon
										class="shrink-0"
										:filename="upload.filename"
									/>
									<div class="flex min-w-0 grow flex-col">
										<span
											class="text-label-small truncate"
											:title="upload.filename"
											>{{ upload.filename }}</span
										>
										<!-- A failure wraps, so its reason can be read in full -->
										<span
											class="text-label-tiny"
											:class="upload.status === UploadStatus.Failed ? 'text-accent-error' : 'text-on-surface-dim truncate'"
											>{{ uploadStatusOf(upload) }}</span
										>
									</div>
									<IconButton
										v-if="upload.status === UploadStatus.Failed"
										:aria-label="t('common.retry')"
										:class="touchTarget"
										icon="arrow-clockwise"
										size="sm"
										:title="t('common.retry')"
										variant="secondary"
										@click="retry(upload.id)"
									/>
									<IconButton
										v-if="upload.status !== UploadStatus.Uploading"
										:aria-label="t('dialog.cancel')"
										:class="touchTarget"
										icon="x"
										size="sm"
										:title="t('dialog.cancel')"
										variant="secondary"
										@click="remove(upload.id)"
									/>
								</div>
								<ProgressBar
									v-if="upload.status === UploadStatus.Uploading"
									class="max-h-050"
									:percentage="upload.progress"
								/>
							</li>
						</ul>

						<!-- Files -->
						<ul
							v-if="visibleFiles.length > 0"
							class="gap-050 flex flex-col"
							data-testid="filemanager"
						>
							<li
								v-for="item in visibleFiles"
								:key="item.matrixEvent.getId()"
							>
								<div
									v-context-menu="(evt: any) => openMenu(evt, menuItems(item), item.matrixEvent.getId())"
									class="hover:bg-surface-elevated rounded-base flex cursor-pointer items-center gap-100 p-100 pointer-coarse:gap-200"
									:class="{
										'bg-surface-elevated': contextMenu.isOpen && contextMenu.currentTargetId === item.matrixEvent.getId(),
									}"
									@click.capture="suppressClickAfterLongPress"
									@click="onRowClick(item)"
								>
									<Checkbox
										v-if="isSelecting"
										:aria-label="filenameOf(item)"
										:model-value="isSelected(item)"
										@click.stop
										@update:model-value="toggleSelected(item)"
									/>
									<InlineSpinner v-if="isDownloading(item.matrixEvent.getContent().url)" />
									<FileIcon
										v-else
										class="shrink-0"
										:filename="filenameOf(item)"
									/>
									<button
										class="rounded-base outline-accent-blue-interactive flex min-w-0 grow cursor-pointer flex-col text-left focus-visible:outline-3"
										type="button"
										@click.stop="onRowClick(item)"
									>
										<span class="gap-050 flex min-w-0 items-center">
											<span
												class="text-label-small truncate"
												:title="filenameOf(item)"
												>{{ filenameOf(item) }}</span
											>
											<template v-if="isSigned(item)">
												<Icon
													class="text-accent-blue shrink-0"
													size="sm"
													:title="t('roomlibrary.info.sign')"
													type="seal-check"
												/>
												<span class="sr-only">{{ t('roomlibrary.info.sign') }}</span>
											</template>
										</span>
										<span class="text-label-tiny text-on-surface-dim truncate">{{ summaryOf(item) }}</span>
									</button>
									<template v-if="!isSelecting">
										<IconButton
											:aria-label="`${t('menu.download_file')}: ${filenameOf(item)}`"
											:class="touchTarget"
											icon="download-simple"
											size="sm"
											:title="t('menu.download_file')"
											variant="secondary"
											@click.stop="downloadItem(item)"
										/>
										<IconButton
											:aria-label="t('message.context_menu')"
											:class="touchTarget"
											data-testid="filemanager-more"
											icon="dots-three-vertical"
											size="sm"
											:title="t('message.context_menu')"
											variant="secondary"
											@click.stop="openMenu($event, menuItems(item), item.matrixEvent.getId(), true)"
										/>
									</template>
								</div>
							</li>
						</ul>
						<p
							v-else-if="files.length > 0"
							class="text-on-surface-dim p-100 text-center"
							role="status"
						>
							{{ t('others.search_nothing_found') }}
						</p>
						<div
							v-else-if="uploads.length === 0"
							class="flex flex-1 flex-col items-center justify-center gap-200 px-200 text-center"
							data-testid="filemanager-empty"
						>
							<Icon
								class="text-on-surface-dim"
								type="folder-simple"
							/>
							<div>
								<p class="font-semibold">{{ t('roomlibrary.empty') }}</p>
								<p class="text-on-surface-dim text-label-small">{{ t('roomlibrary.empty_hint') }}</p>
							</div>
						</div>
					</template>
				</div>

				<FloatingActionButton
					v-if="!isSelecting"
					class="absolute right-200 bottom-200"
					data-testid="library-upload"
					:disabled="remaining === 0"
					icon="upload-simple"
					:label="t('file.upload_files')"
					:title="remaining === 0 ? t('roomlibrary.library_full', [SystemDefaults.maxLibraryFiles]) : t('file.upload_files')"
					@click="openFilePicker()"
				/>
			</div>

			<!-- Footer -->
			<div
				v-if="!isLoading || files.length > 0"
				class="border-on-surface-disabled/25 flex shrink-0 flex-wrap items-center justify-between gap-100 border-t-2 px-200 pt-150"
				data-testid="filemanager-footer"
			>
				<template v-if="isSelecting">
					<Checkbox
						:model-value="allSelected"
						@update:model-value="toggleAll()"
						>{{ t('roomlibrary.select_all') }}</Checkbox
					>
					<span class="text-label-small text-on-surface-dim">{{
						t('roomlibrary.selected_files', selectedIds.size, { named: { count: selectedIds.size } })
					}}</span>
					<div class="flex w-full justify-end gap-100">
						<Button
							size="sm"
							variant="secondary"
							@click="stopSelecting()"
							>{{ t('dialog.cancel') }}</Button
						>
						<Button
							data-testid="filemanager-delete-selected"
							:disabled="selectedIds.size === 0"
							icon="trash"
							size="sm"
							variant="error"
							@click="deleteSelected()"
							>{{ t('roomlibrary.delete_selected') }}</Button
						>
					</div>
				</template>
				<template v-else>
					<span class="text-label-small text-on-surface-dim">{{
						t('roomlibrary.file_count', files.length, { named: { count: files.length, max: SystemDefaults.maxLibraryFiles } })
					}}</span>
					<Button
						v-if="canSelect"
						data-testid="filemanager-select"
						size="sm"
						variant="secondary"
						@click="isSelecting = true"
						>{{ t('roomlibrary.select') }}</Button
					>
				</template>
			</div>
		</div>

		<!-- Screen reader announcements -->
		<p
			class="sr-only"
			data-testid="library-announcement"
			role="status"
		>
			{{ uploadAnnouncement }}
		</p>

		<!-- Drop overlay -->
		<div
			v-if="isDraggingFiles"
			class="border-accent-blue-interactive bg-surface-background/90 rounded-base pointer-events-none absolute inset-100 z-10 flex flex-col items-center justify-center gap-100 border-2 border-dashed p-200 text-center"
		>
			<Icon type="upload-simple" />
			<span>{{ remaining > 0 ? t('roomlibrary.drop_to_upload') : t('roomlibrary.library_full', [SystemDefaults.maxLibraryFiles]) }}</span>
		</div>
	</div>

	<Dialog
		v-if="signingFile"
		:buttons="buttonsCancel"
		:title="t('roomlibrary.sign_file')"
		:width="isMobile ? 'px-400 w-full' : 'w-[600px] px-400'"
		@close="stopSigning()"
	>
		<div class="flex flex-col items-center gap-200">
			<div
				:id="EYiviFlow.Sign"
				class="text-center"
			/>
			<div class="flex flex-col items-center text-center">
				<p>
					{{ t('roomlibrary.sign_file_hash') }} <span class="italic">{{ filenameOf(signingFile) }}</span
					>:
				</p>
				<InlineSpinner
					v-if="!fileHash"
					class="mt-150"
				/>
				<template v-else>
					<div class="bg-accent-secondary rounded-base mt-150 border p-100 font-bold wrap-anywhere text-black">{{ fileHash }}</div>
					<p class="mt-200">{{ t('roomlibrary.check_file_hash') }}</p>
				</template>
			</div>
		</div>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { type Room as MatrixRoom, MsgType } from 'matrix-js-sdk';
	import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import Checkbox from '@hub-client/components/forms/elements/Checkbox.vue';
	import LibraryFileDetails from '@hub-client/components/rooms/LibraryFileDetails.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import FileIcon from '@hub-client/components/ui/FileIcon.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import ProgressBar from '@hub-client/components/ui/ProgressBar.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';
	import SidebarSearchField from '@hub-client/components/ui/SidebarSearchField.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useFileDownload } from '@hub-client/composables/useFileDownload';
	import { type LibraryUpload, UploadStatus, useLibraryUpload } from '@hub-client/composables/useLibraryUpload';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useRoomLibrary } from '@hub-client/composables/useRoomLibrary';
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';
	import { createLogger } from '@hub-client/logic/logging/Logger';
	import { yiviFlow } from '@hub-client/logic/yiviHandler';

	// Models
	import { ContextVariant, type MenuItem } from '@hub-client/models/components/contextMenu.models';
	import { type YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	import { SystemDefaults } from '@hub-client/models/constants';
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import type Room from '@hub-client/models/rooms/Room';
	import { EYiviFlow, type SecuredRoomAttributeResult } from '@hub-client/models/yivi/Tyivi';

	// Stores
	import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
	import { buttonsCancel, useDialog } from '@hub-client/stores/dialog';
	import { useMessageActions } from '@hub-client/stores/message-actions';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		room: Room;
	}>();

	enum LibrarySort {
		Newest = 'newest',
		Oldest = 'oldest',
		NameAsc = 'name_asc',
		NameDesc = 'name_desc',
		Largest = 'largest',
		Uploader = 'uploader',
	}

	// Same attribute as signed messages
	const signingAttribute = 'pbdf.sidn-pbdf.email.email';

	// 40px hit area on touch screens
	const touchTarget = 'relative pointer-coarse:after:absolute pointer-coarse:after:-inset-100';

	const logger = createLogger('RoomLibrary');
	const dialog = useDialog();
	const { t } = useI18n();
	const user = useUser();
	const roles = useRoles();
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
	const { formattedTimeInformation } = useTimeFormat();

	const isLoading = ref(true);
	const libraryVersion = ref(0);
	const filter = ref('');
	const sortOrder = ref(LibrarySort.NameAsc);
	// Hidden while being deleted
	const pendingDeletion = ref(new Set<string>());

	const selectedFileId = sidebar.selectedLibraryFileId;
	const isSelecting = ref(false);
	const selectedIds = ref(new Set<string>());

	const signingFile = shallowRef<TimelineEvent | null>(null);
	const fileHash = ref('');

	const fileInput = ref<HTMLInputElement | null>(null);
	const dragDepth = ref(0);
	const isDraggingFiles = computed(() => dragDepth.value > 0);

	// #region Library contents

	const libraryEvents = computed(() => {
		// Access libraryVersion to trigger re-computation when files are loaded or deleted
		void libraryVersion.value;
		return props.room
			.getLibraryTimeline()
			.filter(
				(e) =>
					e.matrixEvent.event !== null && e.matrixEvent.event.content && Object.keys(e.matrixEvent.event.content).length > 0 && e.isDeleted === false,
			);
	});

	const files = computed(() =>
		libraryEvents.value.filter(
			(e) =>
				(e.matrixEvent.getContent().msgtype === MsgType.File || e.matrixEvent.getContent().msgtype === MsgType.Image) &&
				!pendingDeletion.value.has(e.matrixEvent.getId() ?? ''),
		),
	);

	// Signature events per file id
	const signaturesByFile = computed(() => {
		const signatures = new Map<string, TimelineEvent[]>();
		for (const event of libraryEvents.value) {
			const content = event.matrixEvent.getContent();
			const fileId = content['m.relates_to']?.event_id;
			if (content.msgtype !== PubHubsMgType.SignedFileMessage || !fileId) continue;
			signatures.set(fileId, [...(signatures.get(fileId) ?? []), event]);
		}
		return signatures;
	});

	const filenameOf = (item: TimelineEvent): string => item.matrixEvent.getContent().filename ?? item.matrixEvent.getContent().body ?? '';
	const sizeOf = (item: TimelineEvent): number => item.matrixEvent.getContent().info?.size ?? 0;
	const uploaderOf = (item: TimelineEvent): string => {
		const sender = item.matrixEvent.getSender() ?? '';
		return user.userDisplayName(sender) ?? filters.extractPseudonym(sender);
	};
	const signaturesOf = (item: TimelineEvent) => signaturesByFile.value.get(item.matrixEvent.getId() ?? '') ?? [];
	const isSigned = (item: TimelineEvent) => signaturesOf(item).length > 0;

	const summaryOf = (item: TimelineEvent): string => {
		const size = item.matrixEvent.getContent().info?.size;
		return [uploaderOf(item), typeof size === 'number' ? filters.formatBytes(size, 1) : '', formattedTimeInformation(item.matrixEvent.getTs())]
			.filter((part) => part !== '')
			.join(' · ');
	};

	const byDate = (a: TimelineEvent, b: TimelineEvent) => a.matrixEvent.getTs() - b.matrixEvent.getTs();
	const byName = (a: TimelineEvent, b: TimelineEvent) => filenameOf(a).localeCompare(filenameOf(b), undefined, { numeric: true, sensitivity: 'base' });

	const sorters: Record<LibrarySort, (a: TimelineEvent, b: TimelineEvent) => number> = {
		[LibrarySort.Newest]: (a, b) => byDate(b, a),
		[LibrarySort.Oldest]: byDate,
		[LibrarySort.NameAsc]: byName,
		[LibrarySort.NameDesc]: (a, b) => byName(b, a),
		[LibrarySort.Largest]: (a, b) => sizeOf(b) - sizeOf(a),
		[LibrarySort.Uploader]: (a, b) => uploaderOf(a).localeCompare(uploaderOf(b), undefined, { sensitivity: 'base' }) || byDate(b, a),
	};

	const visibleFiles = computed(() => {
		const term = filter.value.trim().toLocaleLowerCase();
		const matching = term === '' ? files.value : files.value.filter((item) => filenameOf(item).toLocaleLowerCase().includes(term));
		return [...matching].sort(sorters[sortOrder.value]);
	});

	const sortMenuItems = (): MenuItem[] => {
		return Object.values(LibrarySort).map((option) => ({
			label: t(`roomlibrary.sort.${option}`),
			icon: option === sortOrder.value ? 'check' : undefined,
			onClick: () => (sortOrder.value = option),
		}));
	};

	const selectedFile = computed(() => files.value.find((item) => item.matrixEvent.getId() === selectedFileId.value) ?? null);

	// Back to the list when the open file is gone
	watch(selectedFile, (file) => {
		if (!file && selectedFileId.value && !isLoading.value) selectedFileId.value = null;
	});

	const loadLibrary = async () => {
		const roomId = props.room.roomId;
		isLoading.value = true;
		try {
			await props.room.initFileLibrary();
		} catch (error) {
			logger.error('Could not load the file library', error);
		}
		// Room changed while loading
		if (props.room.roomId !== roomId) return;
		isLoading.value = false;
		libraryVersion.value++;
	};

	// #endregion

	// #region Row actions

	const onRowClick = (item: TimelineEvent) => {
		if (isSelecting.value) {
			toggleSelected(item);
		} else {
			selectedFileId.value = item.matrixEvent.getId() ?? null;
		}
	};

	const canDelete = (item: TimelineEvent) => user.userId === item.matrixEvent.getSender() || roles.userIsStewardOrHigher();

	// Shared by the file menu and the details panel
	const fileActions = (item: TimelineEvent, first: MenuItem): MenuItem[] => {
		const actions: MenuItem[] = [first, { label: t('roomlibrary.share_to_timeline'), icon: 'paper-plane-right', onClick: () => shareItem(item) }];
		// One signature per file
		if (!isSigned(item)) {
			actions.push({ label: t('roomlibrary.sign_file'), icon: 'pen-nib', onClick: () => startSigning(item) });
		}
		if (canDelete(item)) {
			actions.push(
				{ divider: true, label: '' },
				{ label: t('roomlibrary.delete_file'), icon: 'trash', variant: ContextVariant.delicate, onClick: () => confirmDeletion(item) },
			);
		}
		return actions;
	};

	const menuItems = (item: TimelineEvent) =>
		fileActions(item, { label: t('roomlibrary.file_details'), icon: 'info', onClick: () => (selectedFileId.value = item.matrixEvent.getId() ?? null) });

	const detailActions = (item: TimelineEvent) =>
		fileActions(item, { label: t('menu.download_file'), icon: 'download-simple', onClick: () => downloadItem(item) });

	/**
	 * A long press opens the context menu, but the browser still fires a click when the finger is lifted.
	 * This functions stops propogation after the context menu has been opened.
	 */
	const suppressClickAfterLongPress = (event: MouseEvent) => {
		// Immediate: the row listens for clicks on itself as well, and that listener has to be stopped too.
		if (contextMenu.isOpen) event.stopImmediatePropagation();
	};

	const downloadItem = async (item: TimelineEvent) => {
		const content = item.matrixEvent.getContent();
		const succeeded = await downloadFile(content.url, content.filename ?? content.body ?? 'file');
		if (!succeeded) {
			dialog.confirm(t('errors.file_download'));
		}
	};

	/**
	 * Hands the file to the message input, so the user can add a message before posting it in the timeline.
	 * The file stays where it is on the media server: nothing is uploaded again.
	 */
	const shareItem = (item: TimelineEvent) => {
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
	};

	// #endregion

	// #region Signing

	const startSigning = async (item: TimelineEvent) => {
		const eventId = item.matrixEvent.getId();
		const roomId = props.room.roomId;
		signingFile.value = item;
		fileHash.value = '';

		const accessToken = pubhubs.Auth.getAccessToken();
		const hash = accessToken
			? await makeHash(accessToken, formUrlfromMxc(item.matrixEvent.getContent().url, true), props.room as unknown as MatrixRoom)
			: '';

		// Dialog closed or another file picked meanwhile
		if (signingFile.value?.matrixEvent.getId() !== eventId) return;
		if (!hash) {
			stopSigning();
			dialog.confirm(t('roomlibrary.sign_error', [filenameOf(item)]));
			return;
		}
		fileHash.value = hash;
		yiviFlow(
			EYiviFlow.Sign,
			(result: YiviSigningSessionResult | SecuredRoomAttributeResult) => finishedSigning(result as YiviSigningSessionResult, roomId, eventId),
			roomId,
			'#' + EYiviFlow.Sign,
			[signingAttribute],
			hash,
		);
	};

	const finishedSigning = async (result: YiviSigningSessionResult, roomId: string, eventId: string | undefined) => {
		stopSigning();
		await pubhubs.addSignedFile(roomId, result, eventId);
	};

	const stopSigning = () => {
		signingFile.value = null;
		fileHash.value = '';
	};

	const handleEsc = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && signingFile.value) {
			stopSigning();
		}
	};

	// #endregion

	// #region Deleting

	/**
	 * @returns whether the file was deleted
	 */
	const deleteFile = async (item: TimelineEvent): Promise<boolean> => {
		const eventId = item.matrixEvent.getId();
		if (!eventId || !canDelete(item)) return false;

		pendingDeletion.value.add(eventId);
		let deleted = false;
		try {
			// The media API is admin only for now. For other users the call fails and the file only leaves the library,
			// so it starts deleting the media as soon as the endpoint allows them.
			await deleteMedia(deleteMediaUrlfromMxc(item.matrixEvent.getContent().url), eventId, props.room.roomId).catch((error) =>
				logger.error('Could not delete the media of file ' + eventId, error),
			);
			deleted = await removeFromTimeline(
				props.room,
				eventId,
				signaturesOf(item).map((e) => e.matrixEvent),
			);
		} catch (error) {
			logger.error('Could not delete file ' + eventId, error);
			deleted = false;
		}
		pendingDeletion.value.delete(eventId);
		libraryVersion.value++;
		return deleted;
	};

	const confirmDeletion = async (item: TimelineEvent) => {
		const confirm = await dialog.okcancel(t('roomlibrary.delete.heading'), t('roomlibrary.delete.content', [filenameOf(item)]));
		if (!confirm) return;
		if (!(await deleteFile(item))) {
			dialog.confirm(t('roomlibrary.delete.failed', [filenameOf(item)]));
		}
	};

	// #endregion

	// #region Selecting (stewards)

	const canSelect = computed(() => roles.userIsStewardOrHigher() && files.value.length > 0);
	const isSelected = (item: TimelineEvent) => selectedIds.value.has(item.matrixEvent.getId() ?? '');
	const allSelected = computed(() => visibleFiles.value.length > 0 && visibleFiles.value.every(isSelected));

	const toggleSelected = (item: TimelineEvent) => {
		const eventId = item.matrixEvent.getId();
		if (!eventId) return;
		if (selectedIds.value.has(eventId)) {
			selectedIds.value.delete(eventId);
		} else {
			selectedIds.value.add(eventId);
		}
	};

	const toggleAll = () => {
		if (allSelected.value) {
			selectedIds.value.clear();
		} else {
			visibleFiles.value.forEach((item) => selectedIds.value.add(item.matrixEvent.getId() ?? ''));
		}
	};

	const stopSelecting = () => {
		isSelecting.value = false;
		selectedIds.value.clear();
	};

	// Files hidden by the search must not stay selected
	watch(filter, () => selectedIds.value.clear());

	const deleteSelected = async () => {
		const items = files.value.filter(isSelected);
		const confirm = await dialog.okcancel(t('roomlibrary.delete.multiple_heading'), t('roomlibrary.delete.multiple_content', [items.length]));
		if (!confirm) return;
		stopSelecting();
		// Delete sequentially to avoid rate limiting
		let failed = 0;
		for (const item of items) {
			if (!(await deleteFile(item))) failed++;
		}
		if (failed > 0) {
			dialog.confirm(t('roomlibrary.delete.multiple_failed'));
		}
	};

	// #endregion

	// #region Uploading

	const { uploads, finished, remaining, addFiles, retry, remove } = useLibraryUpload(
		() => props.room.roomId,
		() => files.value.map(filenameOf),
	);

	const uploadAnnouncement = computed(() => {
		if (!finished.value) return '';
		return t(finished.value.succeeded ? 'roomlibrary.upload_done' : 'roomlibrary.upload_failed', [finished.value.filename]);
	});

	const uploadStatusOf = (upload: LibraryUpload): string => {
		if (upload.status === UploadStatus.Failed) return upload.error ? t(upload.error.key, upload.error.params) : t('file.upload_error');
		if (upload.status === UploadStatus.Uploading) return t('roomlibrary.uploading', [Math.round(upload.progress)]);
		return t('roomlibrary.upload_waiting');
	};

	const openFilePicker = () => {
		if (!fileInput.value) return;
		// Reset so the same file can be picked again
		fileInput.value.value = '';
		fileInput.value.click();
	};

	const onFilesPicked = (event: Event) => {
		const picked = (event.target as HTMLInputElement).files;
		if (picked) addToUploads(picked);
	};

	const addToUploads = (newFiles: FileList) => {
		if (addFiles(newFiles) > 0) {
			dialog.confirm(t('roomlibrary.files_skipped', [SystemDefaults.maxLibraryFiles]));
		}
	};

	const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

	// Counted, as child elements fire these too
	const onDragEnter = (event: DragEvent) => {
		if (isFileDrag(event)) dragDepth.value++;
	};

	const onDragLeave = (event: DragEvent) => {
		if (isFileDrag(event) && dragDepth.value > 0) dragDepth.value--;
	};

	const onDrop = (event: DragEvent) => {
		dragDepth.value = 0;
		if (event.dataTransfer?.files.length) addToUploads(event.dataTransfer.files);
	};

	// Keep the browser from opening files dropped outside the sidebar
	const preventDefault = (event: Event) => event.preventDefault();

	// #endregion

	// Reload on room switch. Declared last because it runs immediately
	watch(
		() => props.room.roomId,
		() => {
			selectedFileId.value = null;
			stopSelecting();
			filter.value = '';
			loadLibrary();
		},
		{ immediate: true },
	);

	onMounted(() => {
		window.addEventListener('keydown', handleEsc);
		document.body.addEventListener('dragover', preventDefault);
		document.body.addEventListener('drop', preventDefault);
	});

	onUnmounted(() => {
		window.removeEventListener('keydown', handleEsc);
		document.body.removeEventListener('dragover', preventDefault);
		document.body.removeEventListener('drop', preventDefault);
	});
</script>
