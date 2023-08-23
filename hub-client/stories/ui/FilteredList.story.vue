<template>
	<Story title="UI/FilteredList">
		<FilteredList :items="items" placeholder="Story filter" @click="clickedItem($event)">
			<template #item="{ item }">
				<span class="dark:text-white">{{ item.name }}</span>
			</template>
		</FilteredList>
	</Story>
</template>

<script setup lang="ts">
	import FilteredList from '@/components/ui/FilteredList.vue';

	const items = [
		{
			name: 'Lorum',
			data: {},
		},
		{
			name: 'Ipsum',
			data: {},
		},
		{
			name: 'Consetetur sadipscing elitr',
			data: {},
		},
	];

	function clickedItem(item: any) {
		alert(item.name);
	}
</script>
