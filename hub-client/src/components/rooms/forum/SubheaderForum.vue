<template>
	<div class="flex flex-col gap-2 py-3">
		<!-- First row with filters and spacing -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<PostsFilterButton />
				<AddNewPostButton />
			</div>
			<SortPostsButton />
		</div>
	</div>
</template>

<script setup lang="ts">
	import AddNewPostButton from '@hub-client/components/rooms/forum/AddNewPostButton.vue';
	import PostsFilterButton from '@hub-client/components/rooms/forum/PostsFilterButton.vue';
	import SortPostsButton from '@hub-client/components/rooms/forum/SortPostsButton.vue';
</script>
