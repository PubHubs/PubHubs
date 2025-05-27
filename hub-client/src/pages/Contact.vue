<template>
	<div></div>
</template>

<script setup lang="ts">
	import { onMounted } from 'vue';
	import { useRouter } from 'vue-router';
	import { api_synapse } from '@/logic/core/api';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { RoomType, useRooms } from '@/logic/store/rooms';
	import Room from '@/model/rooms/Room';

	// Composables
	const pubhubs = usePubHubs();
	const router = useRouter();
	const rooms = useRooms();

	// Constants
	const API_URLS = api_synapse.apiURLS;

	// Initialize on component mount
	onMounted(async () => {
		await initializeAdminContactRoom();
	});

	/**
	 * Initializes the admin contact room
	 */
	async function initializeAdminContactRoom(): Promise<void> {
		const adminIds: string[] = await fetchAdminIds();
		await setupAdminContactRoom(adminIds);
	}

	/**
	 * Fetches admin IDs from the API
	 */
	async function fetchAdminIds(): Promise<string[]> {
		return await api_synapse.apiGET(API_URLS.users);
	}

	/**
	 * Sets up the admin contact room based on existing state
	 */
	async function setupAdminContactRoom(adminIds: string[]): Promise<void> {
		const existingRoom = findAdminContactRoom();

		if (existingRoom) {
			await handleExistingAdminRoom(existingRoom, adminIds);
		} else {
			await createNewAdminRoom(adminIds);
		}
	}

	/**
	 * Handles navigation to an existing admin room and invites new admins or remove them if needed
	 */
	async function handleExistingAdminRoom(room: Room, adminIds: string[]): Promise<void> {
		const roomId = room.roomId;
		const newAdminId = findNewAdminId(adminIds);

		if (newAdminId) {
			await pubhubs.invite(roomId, newAdminId); // We specific case in main-testhub, since we have so many admins leading to rate limit hit.
		}

		const oldAdminIds = removeOldAdminId(adminIds);
		if (oldAdminIds) {
			oldAdminIds.forEach(async (adminId: string) => await pubhubs.client.kick(roomId, adminId));
		}
		await navigateToRoom(roomId);
	}

	/**
	 * Creates a new admin contact room if none exists
	 */
	async function createNewAdminRoom(adminIds: string[]): Promise<void> {
		const adminUsers = adminIds.map((adminId) => pubhubs.client.getUser(adminId)).filter((user) => user !== null);
		const contactTargets = adminUsers.length === 1 ? adminUsers[0] : adminUsers;

		const room = await pubhubs.createPrivateRoomWith(contactTargets, true);

		if (room) {
			await navigateToRoom(room.room_id);
		}
	}

	/**
	 * Navigates to a specific room
	 */
	async function navigateToRoom(roomId: string): Promise<void> {
		await router.push({ name: 'room', params: { id: roomId } });
	}

	/**
	 * Finds the admin contact room if it exists
	 */
	function findAdminContactRoom(): Room | undefined {
		return rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
	}

	/**
	 * Gets the list of existing admin member IDs from the admin contact room
	 */
	function getExistingAdminMemberIds(): string[] {
		const room = findAdminContactRoom();

		if (!room) {
			return [];
		}

		return room.getOtherJoinedMembers().map((member) => member.userId);
	}

	/**
	 * Finds any new admin ID that needs to be invited to the room
	 */
	function findNewAdminId(adminIds: string[]): string | undefined {
		const existingAdminIds = getExistingAdminMemberIds();

		if (existingAdminIds.length >= adminIds.length) {
			return undefined;
		}
		return adminIds.find((id) => !existingAdminIds.includes(id));
	}

	/**
	 *
	 * Find x hub administrators so that they can be removed from the room.
	 */

	function removeOldAdminId(adminIds: string[]): string[] | undefined {
		const existingAdminIds = getExistingAdminMemberIds();

		if (existingAdminIds.length <= adminIds.length) {
			return undefined;
		}
		return existingAdminIds.filter((id) => !adminIds.includes(id));
	}
</script>
