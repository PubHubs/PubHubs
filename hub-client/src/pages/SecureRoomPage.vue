<template>
	<HeaderFooter>
		<template #header>
			<div class="h-full pl-20 md:px-6">
				<div class="flex justify-between relative gap-x-2 h-full w-full">
					<div class="flex shrink-0 gap-x-1 md:gap-x-4 items-center w-[75%] md:w-[60%] overflow-hidden">
						<Icon type="shield" class="shrink-0" size="lg"></Icon>
						<div class="flex flex-col">
							<H1 v-if="rooms.securedRoom.name" class="flex">
								<TruncatedText :title="rooms.securedRoom.name">
									{{ rooms.securedRoom.name }}
								</TruncatedText>
							</H1>
						</div>
					</div>
				</div>
			</div>
		</template>

		<div class="flex h-full dark:text-white">
			<div class="grid md:grid-cols-2 gap-10 max-w-4xl p-10">
				<div v-if="rooms.securedRoom.name" class="flex flex-col gap-4">
					<p class="text-2xl font-semibold line-clamp-4" :title="rooms.securedRoom.name">{{ $t('rooms.secure_room_message_heading') + ' `' + rooms.securedRoom.name + '`' }}</p>
					<p class="text-lg">{{ $t('rooms.secure_room_message') }}</p>
					<p v-if="rooms.securedRoom.user_txt" class="text-lg">{{ $t('rooms.secure_room_enter_info') }}</p>
					<p class="line-clamp-6 text-lg font-semibold" :title="rooms.securedRoom.user_txt">{{ rooms.securedRoom.user_txt }}</p>
				</div>
				<div id="yivi-web-form" class="bg-gray-800 md:p-10 rounded">
					<!-- Content for the right column -->
				</div>
			</div>
		</div>

		<template #footer> </template>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { onMounted, watch } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { MessageType } from '@/store/messagebox';
	import { Message, useMessageBox, useRooms } from '@/store/store';
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
