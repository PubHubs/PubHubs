<template>
	<div class="flex justify-center items-center h-full dark:text-white">
		<div class="grid grid-cols-2 gap-10 max-w-4xl mx-auto p-10">
			<div class="flex flex-col justify-center gap-4">
				<p class="text-2xl font-semibold">{{ $t('rooms.secure_room_message_heading') + ' ' + rooms.securedRoom.name }}</p>
				<p class="text-lg">{{ $t('rooms.secure_room_message') }}</p>
				<p v-if="rooms.securedRoom.user_txt" class="text-lg">{{ $t('rooms.secure_room_enter_info') }}</p>
				<p class="text-lg font-semibold pl-4">{{ rooms.securedRoom.user_txt }}</p>
			</div>
			<div id="yivi-web-form" class="bg-gray-800 p-10 rounded">
				<!-- Content for the right column -->
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { usePubHubs } from '@/core/pubhubsStore';
	import { MessageType } from '@/store/messagebox';
	import { Message, useMessageBox, useRooms } from '@/store/store';
	import { onMounted, watch } from 'vue';
	import { useRoute } from 'vue-router';

	const route = useRoute();

	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const messageBox = useMessageBox();

	watch(route, update);

	onMounted(update);

	async function update() {
		messageBox.sendMessage(new Message(MessageType.RoomChange, ''));
		const access_token = pubhubs.Auth.getAccessToken();
		rooms.yiviSecuredRoomflow(route.params.id as string, access_token);

		await rooms.getSecuredRoomInfo(route.params.id as string);
	}
</script>
