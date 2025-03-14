<template>
	<div>
		<TextInput v-if="!listTop" :placeholder="placeholder" v-model="filter" class="mb-4 w-full" :class="inputClass" @input="changed()"></TextInput>
		<ul v-if="filteredItems.length > 0" :class="listClass + ' max-h-screen overflow-y-scroll'">
			<li v-for="(item, index) in filteredItems" :key="index" class="group block cursor-pointer rounded p-1 hover:bg-lightgray hover:dark:bg-gray-dark" @click="clickedItem(item)">
				<slot name="item" v-bind="{ item }"></slot>
			</li>
		</ul>
		<TextInput v-if="listTop" :placeholder="placeholder" v-model="filter" class="mt-4 w-full" :class="inputClass" @input="changed()"></TextInput>
	</div>
</template>

<script setup lang="ts">
	import { ref, computed } from 'vue';
	import { FilteredListEvent } from '@/model/components/FilteredListEvent';

	const emit = defineEmits(['click', 'filter']);

	const filter = ref('');

	type Props = {
		items: Array<Record<string, any>>;
		filterKey?: string[];
		minLength?: number;
		listTop?: boolean;
		showCompleteList?: boolean;
		inputClass?: string;
		listClass?: string;
		sortby: string;
		placeholder: string;
	};

	const props = withDefaults(defineProps<Props>(), {
		items: () => [],
		filterKey: () => ['name'],
		sortby: '',
		placeholder: 'Filter',
		inputClass: '',
		listClass: '',
		minLength: 1,
		listTop: false,
		showCompleteList: true,
	});

	const filteredItems = computed(() => {
		let items = props.items;
		if (filter.value.length >= props.minLength) {
			const lcFilter = filter.value.toLowerCase();
			items = props.items.filter((item: any) => {
				if (filter.value === '') {
					return true;
				}
				for (const filterKey of props.filterKey) {
					const lcItem = item[filterKey]?.toLowerCase();
					if (lcItem && lcItem.includes(lcFilter)) return true;
				}
				return false;
			});
			if (props.sortby !== '') {
				items = items.toSorted((a: Record<string, any>, b: Record<string, any>) => {
					return a[props.sortby].toLowerCase().localeCompare(b[props.sortby].toLowerCase());
				});
			}
		} else {
			if (!props.showCompleteList) {
				items = [];
			}
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
		filter.value = '';
		emit('click', item);
	}
</script>
