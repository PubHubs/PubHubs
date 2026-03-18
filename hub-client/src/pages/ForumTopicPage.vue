<template>
	<div class="flex h-full flex-col">
		<!-- Shared Header -->
		<div class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b p-8" :class="isMobile ? 'pl-12' : 'pl-8'" data-testid="roomheader">
			<!-- Left: Room info -->
			<div v-if="rooms.currentRoom" class="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden" data-testid="roomtype">
				<Icon type="caret-left" data-testid="back" class="cursor-pointer" @click="router.push({ name: 'room', params: { id: currentRoom.roomId } })" />
				<div class="group relative" :class="!rooms.currentRoom.isDirectMessageRoom() && 'hover:cursor-pointer'" :title="t('menu.copy_room_url')" @click="!rooms.currentRoom.isDirectMessageRoom() && copyRoomUrl">
					<H3 class="text-on-surface flex">
						<TruncatedText class="font-headings font-semibold">
							<RoomName :room="rooms.currentRoom" :title="t('menu.copy_room_url')" />
						</TruncatedText>
					</H3>
					<span v-if="topic.closed" class="text-center align-middle text-3xl font-bold">This topic is closed</span>
					<Icon type="copy" size="sm" class="text-on-surface-dim group-hover:text-on-surface absolute top-0 -right-2" />
				</div>
			</div>

			<!-- Right: Sidebar controls -->
			<div class="flex items-center gap-2">
				<RoomHeaderButtons>
					<!-- Search -->
					<!-- <GlobalBarButton type="magnifying-glass" :selected="sidebar.activeTab.value === SidebarTab.Search" @click="sidebar.toggleTab(SidebarTab.Search)" :title="t('others.search_room')" /> -->
					<!-- Members -->
					<!-- <GlobalBarButton type="users" :selected="sidebar.activeTab.value === SidebarTab.Members" @click="sidebar.toggleTab(SidebarTab.Members)" /> -->
				</RoomHeaderButtons>
			</div>
		</div>

		<!-- Content row: Timeline + Sidebar -->
		<div class="flex flex-1 overflow-hidden">
			<div v-if="topic" class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
				<TopicItem :topic="topic" :room="currentRoom" :current-user="currentUser" :main-topic="topic" />
				<LabelWithDescription class="ml-5" label-class="text-3xl"> Answers: {{ replies?.length }} </LabelWithDescription>
				<div>
					<TopicItem v-for="reply in replies" :key="reply.eventId" :topic="reply" :room="currentRoom" :current-user="currentUser" :replies="true" :main-topic="topic" />
				</div>
			</div>

			<!-- Room sidebar -->
			<RoomSidebar :active-tab="sidebar.activeTab.value" :is-mobile="sidebar.isMobile.value">
				<RoomMemberList v-if="sidebar.activeTab.value === SidebarTab.Members" :room="room!" />
				<RoomSearch v-if="sidebar.activeTab.value === SidebarTab.Search" :room="room!" @scroll-to-event-id="onScrollToEventId" />
			</RoomSidebar>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	import RoomHeaderButtons from '@hub-client/components/rooms/RoomHeaderButtons.vue';
	import RoomMemberList from '@hub-client/components/rooms/RoomMemberList.vue';
	import RoomSearch from '@hub-client/components/rooms/RoomSearch.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import LabelWithDescription from '@hub-client/components/rooms/forum/LabelWithDescription.vue';
	import TopicItem from '@hub-client/components/rooms/forum/TopicItem.vue';

	// import GlobalbarButton from '@hub-client/components/ui/GlobalbarButton.vue';

	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	import { useForumStore } from '@hub-client/stores/forum/forumStore';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	//import { FILTER_STATE, useFilterStore } from '@/plugins/PluginRoomTypeForum/core/filterStore';
	//import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';

	/*const filterStore = useFilterStore();
	const timelineStore = useTimelineStore();
	if (filterStore.filter === FILTER_STATE.MY_TOPICS) {
		timelineStore.createFilteredTimelineWindow(filterStore.topicsAndReplyFilter);
		filterStore.filter = FILTER_STATE.NO;
	}*/

	const { t } = useI18n();
	const router = useRouter();
	const sidebar = useSidebar();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const forumStore = useForumStore();

	const rooms = useRooms();
	const currentRoom = rooms.currentRoom!;

	const route = useRoute();
	const currentUser = useUser();
	const threadKey = route.params.key;
	const topic = computed(() => forumStore.forumTopics.find((t) => t.eventId === threadKey));
	const replies = computed(() => topic.value?.replies);
</script>
