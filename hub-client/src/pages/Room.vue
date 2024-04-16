<template>
	<template v-if="rooms.currentRoomExists">
		<HeaderFooter v-if="plugin == false" class="pl-6">
			<template #header>
				<div class="h-full w-full pl-16 md:pl-0">
					<div class="flex justify-between relative gap-x-2 h-full w-full border-b pb-2 md:pb-4 md:pr-3">
						<div v-if="rooms.currentRoom" class="flex shrink-0 gap-x-1 md:gap-x-4 items-end md:items-center w-9/12 overflow-hidden">
							<Icon :type="rooms.currentRoom.isSecuredRoom() ? 'lock' : 'room'" class="text-blue md:mt-2 shrink-0" size="lg"></Icon>
							<div class="flex flex-col bg-hub-background">
								<TruncatedText>
									<H1 class="m-0 text-hub-accent md:text-xl">{{ $t('rooms.title', [roomName()]) }}</H1>
								</TruncatedText>
								<TruncatedText>
									<p class="text-sm leading-4 hidden md:block">
										<PrivateRoomName v-if="rooms.currentRoom.isPrivateRoom()" :members="members"></PrivateRoomName>
										<span v-else>
											{{ getTopic() }}
										</span>
									</p>
								</TruncatedText>
							</div>
						</div>
						<SearchInput @submit="search"></SearchInput>
					</div>
				</div>
			</template>

			<RoomTimeline v-if="rooms.rooms[id!]" class="scrollbar" :room="rooms.rooms[id!]"></RoomTimeline>

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

	//Passed by the router
	const props = defineProps({
		id: String,
	});

	onMounted(() => {
		update();
	});

	watch(route, () => {
		update();
	});

	function update() {
		//We know the property is there since passed by the router, so we can use '!'
		rooms.changeRoom(props.id!);
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
