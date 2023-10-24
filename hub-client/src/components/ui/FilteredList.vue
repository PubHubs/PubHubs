<template>
	<TextInput :placeholder="placeholder" v-model="filter" class="mb-4 w-full" @changed="changed()"></TextInput>
	<slot name="subtitle"></slot>
	<ul>
		<li v-for="(item, index) in filteredItems" :key="index" class="group cursor-pointer hover:bg-green p-1 rounded" @click="clickedItem(item)">
			<slot name="item" v-bind="{ item }"></slot>
		</li>
	</ul>
</template>

<script setup lang="ts">
	import { ref, computed } from 'vue';
	import { FilteredListEvent } from '@/types/components';

	const emit = defineEmits(['click', 'filter']);

	const filter = ref('');

	const props = defineProps({
		items: {
			type: Array,
			default: () => [],
		},
		filterKey: {
			type: String,
			default: 'name',
		},
		placeholder: {
			type: String,
			default: 'Filter',
		},
	});

	const filteredItems = computed(() => {
		const lcFilter = filter.value.toLowerCase();
		return props.items.filter((item: any) => {
			if (filter.value == '') {
				return true;
			}
			const lcItem = item[props.filterKey]?.toLowerCase();
			return lcItem.includes(lcFilter);
		});
	});

	function changed() {
		filter.value = filter.value.toLocaleLowerCase();
		const event: FilteredListEvent = {
			filter: filter.value,
			length: filteredItems.value.length,
		};
		emit('filter', event);
	}

	function clickedItem(item: any) {
		emit('click', item);
	}
</script>
