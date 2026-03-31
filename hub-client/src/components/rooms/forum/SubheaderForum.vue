<template>
	<div class="mb-2 flex items-center justify-between gap-2 px-5">
		<div class="flex items-center gap-2">
			<PostsFilterButton />
			<AddNewPostButton />
		</div>
		<SortPostsButton />
	</div>
</template>

<script setup lang="ts">
	import AddNewPostButton from '@hub-client/components/rooms/forum/AddNewPostButton.vue';
	import PostsFilterButton from '@hub-client/components/rooms/forum/PostsFilterButton.vue';
	import SortPostsButton from '@hub-client/components/rooms/forum/SortPostsButton.vue';
</script>
