<template>
	<template v-if="rooms.currentRoomExists">
		<HeaderFooter v-if="plugin === false" class="pl-3">
			<template #header>
				<div class="flex pl-20 md:pl-0">
					<div v-if="rooms.currentRoom" class="flex flex-row gap-x-2">
						<Icon :type="rooms.currentRoom.isSecuredRoom() ? 'lock' : 'room'" class="text-blue mt-2" size="lg"></Icon>
						<div class="">
							<H1 class="m-0 text-blue font-bold">{{ $t('rooms.title', [roomName()]) }}</H1>
							<p class="text-sm leading-4">
								<PrivateRoomName v-if="rooms.currentRoom.isPrivateRoom()" :members="members"></PrivateRoomName>
								<span v-else>
									{{ getTopic() }}
								</span>
							</p>
						</div>
					</div>
					<SearchInput class="ml-16 mt-6 flex-auto" @submit="search"></SearchInput>
				</div>
			</template>

			<RoomTimeline class="pt-12 pb-3" :room_id="rooms.currentRoomId"></RoomTimeline>

			<template #footer>
				<MessageInput></MessageInput>
			</template>
		</HeaderFooter>

		<!-- Plugin Room -->
		<component v-if="plugin !== false && plugin !== true" :is="plugin.component"></component>
	</template>
</template>

<script setup lang="ts">
	import { onMounted, watch, ref } from 'vue';
	import { useRoute } from 'vue-router';
	import { useI18n } from 'vue-i18n';
	import { useRooms } from '@/store/store';
	import { PluginProperties, usePlugins } from '@/store/plugins';
	import { TRoomMember } from '@/store/rooms';

	const route = useRoute();
	const { t } = useI18n();
	const rooms = useRooms();
	const plugins = usePlugins();
	const plugin = ref(false as boolean | PluginProperties);

	const members = ref<TRoomMember[]>([]);

	onMounted(() => {
		update();
	});

	watch(route, () => {
		update();
	});

	function update() {
		rooms.changeRoom(route.params.id as string);
		if (!rooms.currentRoom) return;
		members.value = rooms.currentRoom.getPrivateRoomMembers() || [];
		plugin.value = plugins.hasRoomPlugin(rooms.currentRoom);
	}

	function roomName() {
		if (!rooms.currentRoom) return '';
		if (rooms.currentRoom.isPrivateRoom()) {
			return t('rooms.private_room', members.value);
		}
		return rooms.currentRoom.name;
	}

	function getTopic() {
		if (!rooms.currentRoom) return '';
		if (rooms.currentRoom.isPrivateRoom()) {
			return t('rooms.private_members', members.value);
		}
		return rooms.currentRoom.getTopic();
	}

	function search(term: string) {
		alert(t('others.nop') + '[' + term + ']');
	}
</script>
