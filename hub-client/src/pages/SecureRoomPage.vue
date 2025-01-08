<template>
	<HeaderFooter :headerSize="'sm'" :headerMobilePadding="true">
		<template #header>
			<div class="flex gap-x-2 overflow-hidden">
				<Icon type="shield" size="lg"></Icon>
				<H1>
					<TruncatedText :title="rooms.securedRoom.name">
						{{ rooms.securedRoom.name }}
					</TruncatedText>
				</H1>
			</div>
		</template>

		<div class="flex flex-col pt-10 gap-4 max-w-screen-sm mx-auto">
			<div v-if="rooms.securedRoom.name" class="flex flex-col gap-4">
				<p class="text-2xl font-semibold line-clamp-4" :title="rooms.securedRoom.name">{{ $t('rooms.secure_room_message_heading') + ' `' + rooms.securedRoom.name + '`' }}</p>
				<p class="text-lg">{{ $t('rooms.secure_room_message') }}</p>
				<p v-if="rooms.securedRoom.user_txt" class="text-lg">{{ $t('rooms.secure_room_enter_info') }}</p>
				<p class="line-clamp-6 text-lg font-semibold" :title="rooms.securedRoom.user_txt">{{ rooms.securedRoom.user_txt }}</p>
			</div>
			<div id="yivi-web-form">
				<!-- Content for the right column -->
			</div>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { onMounted, watch } from 'vue';
	import { MessageType } from '@/store/messagebox';
	import { Message, useMessageBox, useRooms } from '@/store/store';
	import { useRoute } from 'vue-router';

	const route = useRoute();

	const rooms = useRooms();
	const messageBox = useMessageBox();

	watch(route, update);

	onMounted(update);

	async function update() {
		messageBox.sendMessage(new Message(MessageType.RoomChange, ''));
		rooms.yiviSecuredRoomflow(route.params.id as string);

		await rooms.getSecuredRoomInfo(route.params.id as string);
	}
</script>
