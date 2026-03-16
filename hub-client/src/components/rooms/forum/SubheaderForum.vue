<template>
	<div class="flex flex-col gap-2 py-3">
		<!-- First row with filters and spacing -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<PostsFilterButton />
				<SortPostsButton />
				<AddNewPostButton class="hidden md:inline-flex" />
			</div>
			<!-- The search bar/input is very ugly. Change this when fixing the funtionality of the search bar as well. -->
			<SearchInput class="ml-auto" :search-parameters="searchParameters" @scroll-to-event-id="onScrollToEventId" :room="rooms.currentRoom" />
		</div>

		<!-- Depending on screen size there is a second row showing Add New button, else its in the first row -->
		<div class="flex justify-start md:hidden">
			<AddNewPostButton />
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';
	import { useRouter } from 'vue-router';

	import SearchInput from '@hub-client/components/forms/SearchInput.vue';
	// Components
	import AddNewPostButton from '@hub-client/components/rooms/forum/AddNewPostButton.vue';
	import PostsFilterButton from '@hub-client/components/rooms/forum/PostsFilterButton.vue';
	import SortPostsButton from '@hub-client/components/rooms/forum/SortPostsButton.vue';

	// Models
	import { TSearchParameters } from '@hub-client/models/search/TSearch';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();
	const router = useRouter();
	const searchParameters = ref<TSearchParameters>({ roomId: rooms.currentRoom!.roomId, term: '' });

	async function onScrollToEventId(ev: any) {
		await router.push({ name: 'topic', params: { key: ev.eventId } });
	}
</script>
