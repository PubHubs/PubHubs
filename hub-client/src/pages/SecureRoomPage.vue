<template>
	<HeaderFooter>
		<template #header>
			<div class="flex gap-x-2 overflow-hidden">
				<Icon type="shield" size="lg" />
				<H1>
					<TruncatedText :title="rooms.securedRoom.name">
						{{ rooms.securedRoom.name }}
					</TruncatedText>
				</H1>
			</div>
		</template>

		<div class="mx-auto flex max-w-screen-sm flex-col gap-4 pt-10">
			<div v-if="rooms.securedRoom.name" class="flex flex-col gap-4">
				<p class="line-clamp-4 text-2xl font-semibold" :title="rooms.securedRoom.name">
					{{ $t('rooms.secure_room_message_heading') + ' `' + rooms.securedRoom.name + '`' }}
				</p>
				<p class="text-lg">{{ $t('rooms.secure_room_message') }}</p>
				<p v-if="rooms.securedRoom.user_txt" class="text-lg">
					{{ $t('rooms.secure_room_enter_info') }}
				</p>
				<p class="line-clamp-6 text-lg font-semibold" :title="rooms.securedRoom.user_txt">
					{{ rooms.securedRoom.user_txt }}
				</p>
			</div>
			<div id="yivi-web-form">
				<!-- Content for the right column -->
			</div>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, watch } from 'vue';
	import { useRoute } from 'vue-router';

	// Components
	import H1 from '@hub-client/components/elements/H1.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';

	// Stores
	import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
	import { useRooms } from '@hub-client/stores/rooms';

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
