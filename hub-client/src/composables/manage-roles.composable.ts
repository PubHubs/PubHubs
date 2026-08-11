// Packages
import { Direction, EventType, Filter, type IRoomEvent } from 'matrix-js-sdk';
import { computed, onMounted, ref, watch } from 'vue';

// Composables
import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { DisclosurePurpose } from '@hub-client/models/components/signedMessages';
import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Types
enum RoleInvitationStatus {
	Disclosed = 'disclosed',
	Pending = 'pending',
}

type TRoleInvitation = {
	userId: string;
	displayName: string;
	status: RoleInvitationStatus.Disclosed | RoleInvitationStatus.Pending;
	attributes: Array<{ id: string; rawvalue: string }> | null;
	roomId: string;
	disclosureRoomId: string;
	disclosedEventId?: string;
	requestEventId: string;
	purpose: DisclosurePurpose;
};

// Types
type RoleType = 'steward-invitation' | 'expert-invitation' | 'active-steward' | 'active-expert';

type TRoleEntry = {
	id: string;
	userId: string;
	displayName: string;
	roomId: string;
	roomName: string;
	type: RoleType;
	status?: RoleInvitationStatus;
	attributes?: Array<{ id: string; rawvalue: string }> | null;
	// For invitations
	invitation?: TRoleInvitation;
};

function useManageRoles() {
	// Stores
	const userStore = useUser();
	const roomStore = useRooms();
	const pubhubsStore = usePubhubsStore();
	const sidebar = useSidebar();
	const logger = createLogger('manage-roles');

	// Constants
	const BATCH_SIZE = 5; // Limit concurrent API requests
	const MESSAGES_PER_PAGE = 50; // Number of messages to fetch per request

	// Refs
	const selectedRoleId = ref<string | undefined>();
	const isLoading = ref(false);
	const isLoadingMore = ref(false);
	const roleEntries = ref<TRoleEntry[]>([]);
	const roleInvitations = ref<TRoleInvitation[]>([]);

	// Pagination state: maps DM room ID to its pagination token
	const paginationTokens = ref<Map<string, string | null>>(new Map());
	const hasMoreToLoad = ref(false);

	// Computed
	const isAdmin = computed(() => userStore.isAdmin);

	const selectedRole = computed(() => {
		if (!selectedRoleId.value) return undefined;
		return roleEntries.value.find((p) => p.id === selectedRoleId.value);
	});

	// Functions

	/**
	 * Process items in batches to limit concurrent API requests.
	 * This prevents overwhelming the server when there are many DM rooms.
	 */
	const processBatched = async <T, R>(items: T[], batchSize: number, processor: (item: T) => Promise<R>): Promise<R[]> => {
		const results: R[] = [];
		for (let i = 0; i < items.length; i += batchSize) {
			const batch = items.slice(i, i + batchSize);
			const batchResults = await Promise.all(batch.map(processor));
			results.push(...batchResults);
		}
		return results;
	};

	/**
	 * Fetches role invitations from DM rooms.
	 * @param loadMore - If true, loads more messages using pagination tokens
	 */
	const fetchRoleInvitations = async (loadMore = false) => {
		// Build a Set of public room IDs for O(1) lookup
		const publicRoomIds = new Set(roomStore.roomList.filter((room) => !DirectRooms.includes(room.roomType as RoomType)).map((room) => room.roomId));

		// Get all DM rooms
		const dmRooms = roomStore.fetchRoomList(DirectRooms).filter((room) => room.roomType === RoomType.PH_MESSAGES_DM);

		// Reset pagination tokens if not loading more
		if (!loadMore) {
			paginationTokens.value = new Map();
		}

		const eventFilter = new Filter(undefined);
		eventFilter.setDefinition({
			room: { timeline: { limit: MESSAGES_PER_PAGE, types: [EventType.RoomMessage] } },
		});

		// Track if any room has more messages to load
		let anyRoomHasMore = false;

		// Process DM rooms in batches
		const processDmRoom = async (dmRoom: (typeof dmRooms)[0]): Promise<TRoleInvitation[]> => {
			try {
				// Get the pagination token for this room (if loading more)
				const fromToken = loadMore ? paginationTokens.value.get(dmRoom.roomId) : null;

				// Skip rooms we've already fully paginated through (token explicitly set to null).
				// A room not yet present in the map (fromToken === undefined) hasn't been fetched yet.
				if (loadMore && paginationTokens.value.has(dmRoom.roomId) && fromToken === null) {
					return [];
				}

				const events = await pubhubsStore.client.createMessagesRequest(
					dmRoom.roomId,
					fromToken ?? null,
					MESSAGES_PER_PAGE,
					Direction.Backward,
					eventFilter,
				);
				if (!events) return [];

				// Store the pagination token for this room (null means no more messages)
				if (events.end && events.chunk.length === MESSAGES_PER_PAGE) {
					paginationTokens.value.set(dmRoom.roomId, events.end);
					anyRoomHasMore = true;
				} else {
					// No more messages in this room
					paginationTokens.value.set(dmRoom.roomId, null);
				}

				// Sort events by timestamp (newest first)
				const sortedEvents = [...events.chunk].sort((a, b) => (b.origin_server_ts ?? 0) - (a.origin_server_ts ?? 0));

				// Find all disclosure request events and group by target room
				const requestsByRoom = new Map<string, IRoomEvent>();
				for (const event of sortedEvents) {
					if (event.content.msgtype !== PubHubsMgType.AskDisclosureMessage) continue;
					const targetRoomId = event.content.ask_disclosure_message?.replyToRoomId;
					// Only include requests for public rooms, keep the latest (first found due to sort)
					if (targetRoomId && publicRoomIds.has(targetRoomId) && !requestsByRoom.has(targetRoomId)) {
						requestsByRoom.set(targetRoomId, event);
					}
				}

				// Build invitation entries from the requests
				const requests: TRoleInvitation[] = [];
				for (const [targetRoomId, latestRequest] of requestsByRoom) {
					const userId = latestRequest.content.ask_disclosure_message.userId;
					const purpose = latestRequest.content.ask_disclosure_message.purpose ?? DisclosurePurpose.Steward;
					const userDisclosedMessage = sortedEvents.find(
						(e: IRoomEvent) => e.content.msgtype === PubHubsMgType.DisclosedMessage && e.sender === userId,
					);
					const attributes =
						userDisclosedMessage?.content.signed_message.disclosed
							.flat()
							.map((a: { id: string; rawvalue: string }) => ({ id: a.id, rawvalue: a.rawvalue })) ?? null;

					requests.push({
						userId,
						displayName: userStore.userDisplayName(userId) ?? userId,
						status: userDisclosedMessage ? RoleInvitationStatus.Disclosed : RoleInvitationStatus.Pending,
						attributes,
						roomId: targetRoomId,
						disclosureRoomId: dmRoom.roomId,
						disclosedEventId: userDisclosedMessage?.event_id,
						requestEventId: latestRequest.event_id,
						purpose,
					});
				}
				return requests;
			} catch (error) {
				logger.error(`Failed to fetch messages from DM room ${dmRoom.roomId}:`, error);
				return [];
			}
		};

		const results = await processBatched(dmRooms, BATCH_SIZE, processDmRoom);
		const newInvitations = results.flat();

		if (loadMore) {
			// Merge new invitations with existing ones, avoiding duplicates
			const existingIds = new Set(roleInvitations.value.map((inv) => `${inv.userId}-${inv.roomId}`));
			const uniqueNewInvitations = newInvitations.filter((inv) => !existingIds.has(`${inv.userId}-${inv.roomId}`));
			roleInvitations.value = [...roleInvitations.value, ...uniqueNewInvitations];
		} else {
			roleInvitations.value = newInvitations;
		}

		hasMoreToLoad.value = anyRoomHasMore;
	};

	/**
	 * Load more role invitations using pagination.
	 */
	const loadMoreInvitations = async () => {
		if (!hasMoreToLoad.value || isLoadingMore.value) return;

		isLoadingMore.value = true;
		try {
			await fetchRoleInvitations(true);
			rebuildRoleEntries();
		} finally {
			isLoadingMore.value = false;
		}
	};

	/**
	 * Rebuilds role entries from current invitations and power levels.
	 * Called after fetching invitations or loading more.
	 */
	const rebuildRoleEntries = () => {
		const entries: TRoleEntry[] = [];

		// Add invitations to entries based on purpose
		for (const invitation of roleInvitations.value) {
			const room = roomStore.roomList.find((r) => r.roomId === invitation.roomId);
			const isExpert = invitation.purpose === DisclosurePurpose.Expert;
			entries.push({
				id: `${isExpert ? 'expert' : 'steward'}-inv-${invitation.userId}-${invitation.roomId}`,
				userId: invitation.userId,
				displayName: invitation.displayName,
				roomId: invitation.roomId,
				roomName: room?.name ?? invitation.roomId,
				type: isExpert ? 'expert-invitation' : 'steward-invitation',
				status: invitation.status,
				attributes: invitation.attributes,
				invitation,
			});
		}

		// Add active stewards and experts from all rooms based on power levels
		const allRooms = roomStore.roomList;
		for (const room of allRooms) {
			// Skip direct message rooms
			if (DirectRooms.includes(room.roomType as RoomType)) continue;

			// Get power levels from state events
			const powerLevelsEvent = room.stateEvents.find((e) => e.type === EventType.RoomPowerLevels);
			if (powerLevelsEvent?.content?.users) {
				const users = powerLevelsEvent.content.users as Record<string, number>;

				for (const [userId, powerLevel] of Object.entries(users)) {
					// Skip system users
					if (userId.startsWith('@notices_user:')) continue;

					// Experts: power level >= Expert (25) but < Steward (50)
					if (powerLevel >= UserPowerLevel.Expert && powerLevel < UserPowerLevel.Steward) {
						entries.push({
							id: `expert-${userId}-${room.roomId}`,
							userId,
							displayName: userStore.userDisplayName(userId) ?? userId,
							roomId: room.roomId,
							roomName: room.name,
							type: 'active-expert',
						});
					}
					// Stewards: power level >= Steward (50) but < Admin (100)
					else if (powerLevel >= UserPowerLevel.Steward && powerLevel < UserPowerLevel.Admin) {
						entries.push({
							id: `steward-${userId}-${room.roomId}`,
							userId,
							displayName: userStore.userDisplayName(userId) ?? userId,
							roomId: room.roomId,
							roomName: room.name,
							type: 'active-steward',
						});
					}
				}
			}
		}

		// Sort entries: invitations first (disclosed before pending), then active by room
		entries.sort((a, b) => {
			const isInvitationA = a.type.includes('invitation');
			const isInvitationB = b.type.includes('invitation');

			// Invitations first
			if (isInvitationA && !isInvitationB) return -1;
			if (!isInvitationA && isInvitationB) return 1;

			// For invitations, disclosed first
			if (isInvitationA && isInvitationB) {
				if (a.status === RoleInvitationStatus.Disclosed && b.status !== RoleInvitationStatus.Disclosed) return -1;
				if (a.status !== RoleInvitationStatus.Disclosed && b.status === RoleInvitationStatus.Disclosed) return 1;
			}

			// Then sort by room name, then user name
			const roomCompare = a.roomName.localeCompare(b.roomName);
			if (roomCompare !== 0) return roomCompare;
			return a.displayName.localeCompare(b.displayName);
		});

		roleEntries.value = entries;
	};

	const fetchRoles = async () => {
		isLoading.value = true;

		try {
			// Fetch invitations (both steward and expert) from all rooms
			await fetchRoleInvitations();
			rebuildRoleEntries();
		} finally {
			isLoading.value = false;
		}
	};

	const selectRole = (entry: TRoleEntry) => {
		selectedRoleId.value = entry.id;
		sidebar.openTab(SidebarTab.ManageUser);
	};

	const clearSelection = () => {
		selectedRoleId.value = undefined;
	};

	const removeRoleInvite = async (roleInvite: TRoleInvitation): Promise<void> => {
		roleInvitations.value = roleInvitations.value.filter((u) => u.userId !== roleInvite.userId || u.roomId !== roleInvite.roomId);

		try {
			await pubhubsStore.client.redactEvent(roleInvite.disclosureRoomId, roleInvite.requestEventId);
		} catch (error) {
			logger.error('Failed to redact disclosure request event:', error);
		}

		if (roleInvite.disclosedEventId) {
			try {
				await pubhubsStore.client.redactEvent(roleInvite.disclosureRoomId, roleInvite.disclosedEventId);
			} catch (error) {
				logger.error('Failed to redact disclosed event:', error);
			}
		}
	};

	const promoteToSteward = async (entry: TRoleEntry) => {
		if (entry.type !== 'steward-invitation' || !entry.invitation) return;

		try {
			// Set user's power level to Steward (50); authorized by Synapse's own power-level checks for this room
			await pubhubsStore.client.setPowerLevel(entry.invitation.roomId, entry.invitation.userId, UserPowerLevel.Steward);

			await removeRoleInvite(entry.invitation);
			await fetchRoles();
			clearSelection();
			sidebar.close();
		} catch (error) {
			logger.error('Failed to promote user to steward:', error);
		}
	};

	const promoteToExpert = async (entry: TRoleEntry) => {
		if (entry.type !== 'expert-invitation' || !entry.invitation) return;

		try {
			// Set user's power level to Expert (25)
			await pubhubsStore.client.setPowerLevel(entry.roomId, entry.userId, UserPowerLevel.Expert);

			// Remove the invitation
			await removeRoleInvite(entry.invitation);
			await fetchRoles();
			clearSelection();
			sidebar.close();
		} catch (error) {
			logger.error('Failed to promote user to expert:', error);
		}
	};

	const rejectInvitation = async (entry: TRoleEntry) => {
		if (!entry.type.includes('invitation') || !entry.invitation) return;
		await removeRoleInvite(entry.invitation);
		await fetchRoles();
		clearSelection();
		sidebar.close();
	};

	const demoteSteward = async (entry: TRoleEntry) => {
		if (entry.type !== 'active-steward') return;

		try {
			// Reset user's power level to User (0)
			await pubhubsStore.client.setPowerLevel(entry.roomId, entry.userId, UserPowerLevel.User);

			await fetchRoles();
			clearSelection();
			sidebar.close();
		} catch (error) {
			logger.error('Failed to demote steward:', error);
		}
	};

	const removeExpert = async (entry: TRoleEntry) => {
		if (entry.type !== 'active-expert') return;

		try {
			// Reset user's power level to User (0)
			await pubhubsStore.client.setPowerLevel(entry.roomId, entry.userId, UserPowerLevel.User);

			await fetchRoles();
			clearSelection();
			sidebar.close();
		} catch (error) {
			logger.error('Failed to remove expert:', error);
		}
	};

	// Watchers
	watch(
		() => sidebar.activeTab.value,
		(tab) => {
			if (tab === SidebarTab.None) {
				clearSelection();
			}
		},
	);

	// Lifecycle
	onMounted(() => {
		fetchRoles();
	});

	return {
		// Refs
		roleEntries,
		selectedRoleId,
		selectedRole,
		isLoading,
		isLoadingMore,
		hasMoreToLoad,
		// Computed
		isAdmin,
		// Functions
		fetchRoles,
		loadMoreInvitations,
		selectRole,
		clearSelection,
		promoteToSteward,
		promoteToExpert,
		rejectInvitation,
		demoteSteward,
		removeExpert,
	};
}

export { RoleType, TRoleEntry, RoleInvitationStatus, TRoleInvitation, useManageRoles };
