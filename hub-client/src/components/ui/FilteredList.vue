<template>
	<TextInput :placeholder="placeholder" v-model="filter" class="mb-4 w-full" @changed="changed()"></TextInput>
	<slot name="subtitle"></slot>
	<ul>
		<li v-for="(item, index) in filteredItems" :key="index" class="group block cursor-pointer hover:bg-green p-1 rounded" @click="clickedItem(item)">
			<slot name="item" v-bind="{ item }"></slot>
		</li>
	</ul>
</template>

<script setup lang="ts">
	import { ref, computed } from 'vue';
	import { FilteredListEvent } from '@/types/components';

	const emit = defineEmits(['click', 'filter']);

	const filter = ref('');

	type Props = {
		items: Array<Record<string, any>>;
		filterKey?: string;
		sortby: string;
		placeholder: string;
	};

	const props = withDefaults(defineProps<Props>(), {
		items: () => [],
		filterKey: 'name',
		sortby: '',
		placeholder: 'Filter',
	});

	const filteredItems = computed(() => {
		const lcFilter = filter.value.toLowerCase();
		let items = props.items.filter((item: any) => {
			if (filter.value == '') {
				return true;
			}
			const lcItem = item[props.filterKey]?.toLowerCase();
			return lcItem.includes(lcFilter);
		});
		if (props.sortby != '') {
			items = items.toSorted((a: Record<string, any>, b: Record<string, any>) => {
				return a[props.sortby].toLowerCase().localeCompare(b[props.sortby].toLowerCase());
			});
		}
		return items;
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
