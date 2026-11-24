// Packages
import { Direction, EventType, Filter, type IRoomEvent } from 'matrix-js-sdk';
import { computed, onMounted, ref, watch } from 'vue';

// Composables
import { usePowerLevels } from '@hub-client/composables/usePowerLevels';
import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

// Logic
import { APIService } from '@hub-client/logic/core/apiService';
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { createLogger } from '@hub-client/logic/logging/Logger';
import { type PowerLevelsContent, findPowerLevelsContent, powerLevelOf, stateEventPowerLevel } from '@hub-client/logic/utils/powerLevelUtils';

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

// Whether the current user may change the selected role, checked against the server since a hub admin is often not in the room
type RoleAccess = 'checking' | 'allowed' | 'join-required' | 'power-required';

// How gaining access to a role's room went: below-admin when the hub admin got less than room admin, since nobody left
// on the hub was room admin
type GainAccessResult = 'done' | 'below-admin' | 'failed';

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

// A room whose roles are listed. Only rooms the user isn't synced with carry their power levels, the others are read live.
type TManagedRoom = {
	roomId: string;
	name: string;
	powerLevelUsers?: Record<string, number>;
};

function useManageRoles() {
	// Stores
	const userStore = useUser();
	const roomStore = useRooms();
	const pubhubsStore = usePubhubsStore();
	const sidebar = useSidebar();
	const { powerLevelUsers } = usePowerLevels();
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
	const roleAccess = ref<RoleAccess>('checking');
	const managedRooms = ref<TManagedRoom[]>([]);

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
	 * Collects the rooms whose roles are listed: the user's own rooms, and for hub admins also every other room in the public
	 * room directory, so they see requests and roles in rooms they haven't joined. The power levels of those rooms aren't
	 * synced, so they come from the admin API.
	 */
	const fetchManagedRooms = async () => {
		const ownRooms: TManagedRoom[] = roomStore.roomList
			.filter((room) => !DirectRooms.includes(room.roomType as RoomType))
			.map((room) => ({ roomId: room.roomId, name: room.name }));
		if (!isAdmin.value) {
			managedRooms.value = ownRooms;
			return;
		}

		const ownRoomIds = new Set(ownRooms.map((room) => room.roomId));
		const otherRooms = (await pubhubsStore.getPublicRoomsSafe()).filter((room) => !ownRoomIds.has(room.room_id));
		const fetchedRooms = await processBatched(otherRooms, BATCH_SIZE, async (room): Promise<TManagedRoom> => {
			const managedRoom = { roomId: room.room_id, name: room.name ?? room.room_id };
			try {
				const roomState = await APIService.adminGetRoomState(room.room_id);
				return { ...managedRoom, powerLevelUsers: findPowerLevelsContent(roomState.state)?.users ?? {} };
			} catch (error) {
				// The room's invitations can still be listed without its power levels
				logger.error(`Failed to fetch power levels of ${room.room_id}:`, error);
				return { ...managedRoom, powerLevelUsers: {} };
			}
		});
		managedRooms.value = [...ownRooms, ...fetchedRooms];
	};

	/**
	 * Fetches role invitations from DM rooms.
	 * @param loadMore - If true, loads more messages using pagination tokens
	 */
	const fetchRoleInvitations = async (loadMore = false) => {
		// Build a Set of public room IDs for O(1) lookup
		const publicRoomIds = new Set(managedRooms.value.map((room) => room.roomId));

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
			const room = managedRooms.value.find((r) => r.roomId === invitation.roomId);
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
		for (const room of managedRooms.value) {
			for (const [userId, powerLevel] of Object.entries(room.powerLevelUsers ?? powerLevelUsers(room.roomId))) {
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

		roleEntries.value = entries.filter((entry) => !(entry.userId === userStore.userId && entry.type.includes('invitation')));
	};

	/**
	 * @param collectRooms - Off after a role change: that only happens in a room the user has joined, whose power levels
	 * are read live, so this saves hub admins a state request for every room they aren't in
	 */
	const loadRoles = async (collectRooms: boolean) => {
		isLoading.value = true;

		try {
			if (collectRooms) await fetchManagedRooms();
			// Fetch invitations (both steward and expert) from all rooms
			await fetchRoleInvitations();
			rebuildRoleEntries();
		} finally {
			isLoading.value = false;
		}
	};

	const fetchRoles = () => loadRoles(true);

	const refreshRoles = () => loadRoles(false);

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

	/**
	 * @returns whether the power level change went through
	 */
	const promoteToSteward = async (entry: TRoleEntry): Promise<boolean> => {
		if (entry.type !== 'steward-invitation' || !entry.invitation) return false;

		try {
			// Set user's power level to Steward (50); the hub's spam checker allows stewards and up to do this
			await pubhubsStore.client.setPowerLevel(entry.invitation.roomId, entry.invitation.userId, UserPowerLevel.Steward);

			await removeRoleInvite(entry.invitation);
			await refreshRoles();
			clearSelection();
			sidebar.close();
			return true;
		} catch (error) {
			logger.error('Failed to promote user to steward:', error);
			return false;
		}
	};

	/**
	 * @returns whether the power level change went through
	 */
	const promoteToExpert = async (entry: TRoleEntry): Promise<boolean> => {
		if (entry.type !== 'expert-invitation' || !entry.invitation) return false;

		try {
			// Set user's power level to Expert (25)
			await pubhubsStore.client.setPowerLevel(entry.roomId, entry.userId, UserPowerLevel.Expert);

			// Remove the invitation
			await removeRoleInvite(entry.invitation);
			await refreshRoles();
			clearSelection();
			sidebar.close();
			return true;
		} catch (error) {
			logger.error('Failed to promote user to expert:', error);
			return false;
		}
	};

	/**
	 * The power level the current user needs in the room to change the given role.
	 */
	const requiredPowerLevel = (entry: TRoleEntry, content: PowerLevelsContent): number => {
		// Matrix only lets someone change the level of a user below their own, so demoting another steward takes a room admin
		if (entry.type === 'active-steward' && entry.userId !== userStore.userId) return UserPowerLevel.Admin;
		// The hub's spam checker rejects power level changes from anyone below steward
		return Math.max(stateEventPowerLevel(content, EventType.RoomPowerLevels), UserPowerLevel.Steward);
	};

	const fetchRoleAccess = async (entry: TRoleEntry): Promise<RoleAccess> => {
		// Matrix only accepts power level changes from joined members, hub admins included
		if (!(await pubhubsStore.isUserRoomMember(userStore.userId!, entry.roomId))) return 'join-required';
		try {
			const content = await pubhubsStore.getPowerLevelEventContent(entry.roomId);
			return powerLevelOf(content, userStore.userId) >= requiredPowerLevel(entry, content) ? 'allowed' : 'power-required';
		} catch (error) {
			// The server still checks the change itself, so don't block on a failed lookup
			logger.error(`Failed to fetch power levels of ${entry.roomId}:`, error);
			return 'allowed';
		}
	};

	const checkRoleAccess = async (entry: TRoleEntry) => {
		roleAccess.value = 'checking';
		const access = await fetchRoleAccess(entry);
		// The selection may have moved on while waiting
		if (selectedRoleId.value === entry.id) roleAccess.value = access;
	};

	/**
	 * Joins the room of the role, as room admin for hub admins: joining alone leaves them at power level 0.
	 */
	const gainRoleAccess = async (entry: TRoleEntry): Promise<GainAccessResult> => {
		let powerLevel: number | undefined;
		if (isAdmin.value) {
			try {
				powerLevel = await APIService.takeOverRoom(entry.roomId);
			} catch (error) {
				logger.error(`Failed to make ${userStore.userId} room admin of ${entry.roomId}:`, error);
				return 'failed';
			}
		}
		// joinRoom reports its own failures (by going to the error page), only stop here
		if ((await pubhubsStore.joinRoom(entry.roomId)) !== 0) return 'failed';
		// Joined now, so read its power levels live from here on instead of the snapshot taken while not in it
		managedRooms.value = managedRooms.value.map((room) => (room.roomId === entry.roomId ? { roomId: room.roomId, name: room.name } : room));
		await checkRoleAccess(entry);
		return powerLevel !== undefined && powerLevel < UserPowerLevel.Admin ? 'below-admin' : 'done';
	};

	const rejectInvitation = async (entry: TRoleEntry) => {
		if (!entry.type.includes('invitation') || !entry.invitation) return;
		await removeRoleInvite(entry.invitation);
		await refreshRoles();
		clearSelection();
		sidebar.close();
	};

	/**
	 * @returns whether the power level change went through
	 */
	const demoteSteward = async (entry: TRoleEntry): Promise<boolean> => {
		if (entry.type !== 'active-steward') return false;

		try {
			// Reset user's power level to User (0)
			await pubhubsStore.client.setPowerLevel(entry.roomId, entry.userId, UserPowerLevel.User);

			await refreshRoles();
			clearSelection();
			sidebar.close();
			return true;
		} catch (error) {
			logger.error('Failed to demote steward:', error);
			return false;
		}
	};

	/**
	 * @returns whether the power level change went through
	 */
	const removeExpert = async (entry: TRoleEntry): Promise<boolean> => {
		if (entry.type !== 'active-expert') return false;

		try {
			// Reset user's power level to User (0)
			await pubhubsStore.client.setPowerLevel(entry.roomId, entry.userId, UserPowerLevel.User);

			await refreshRoles();
			clearSelection();
			sidebar.close();
			return true;
		} catch (error) {
			logger.error('Failed to remove expert:', error);
			return false;
		}
	};

	// Watchers
	watch(selectedRole, (entry, previous) => {
		if (entry && entry.id !== previous?.id) checkRoleAccess(entry);
	});

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
		roleAccess,
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
		gainRoleAccess,
		demoteSteward,
		removeExpert,
	};
}

export { GainAccessResult, RoleAccess, RoleType, TRoleEntry, RoleInvitationStatus, TRoleInvitation, useManageRoles };
