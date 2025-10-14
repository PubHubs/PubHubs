<template>
	<div class="flex w-full flex-col">
		<div class="flex w-full items-center gap-4 pb-4">
			<Icon type="compass" class="text-surface-high dark:text-on-surface-dim" />
			<TextInput v-if="!listTop" :placeholder="placeholder" v-model="filter" class="h-8 w-full border-none !bg-surface-low ~text-label-min/label-max" :class="inputClass" @input="changed()" />
		</div>
		<ul v-if="filteredItems.length > 0" :class="listClass + ' flex h-full flex-col gap-2 overflow-y-auto overflow-x-hidden rounded-md'">
			<li v-for="(item, index) in filteredItems" :key="index" class="group block" @click="clickedItem(item)">
				<slot name="item" v-bind="{ item }"></slot>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	import { ref, computed } from 'vue';
	import { FilteredListEvent } from '@/model/components/FilteredListEvent';
	import { User as MatrixUser } from 'matrix-js-sdk';

	import Icon from '@/components/elements/Icon.vue';

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
		selected?: Array<MatrixUser>;
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
		selected: () => [],
	});

	const filteredItems = computed(() => {
		let itemsToFilter = props.items;

		if (props.selected && props.selected.length > 0) {
			// Check if 'selected' exists and has items
			const selectedUserIds = new Set(props.selected.map((user) => user.userId));
			itemsToFilter = itemsToFilter.filter((item: any) => !selectedUserIds.has(item.userId));
		}

		if (filter.value.length >= props.minLength) {
			const lcFilter = filter.value.toLowerCase();
			itemsToFilter = itemsToFilter.filter((item: any) => {
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
				itemsToFilter = itemsToFilter.toSorted((a: Record<string, any>, b: Record<string, any>) => {
					return a[props.sortby].toLowerCase().localeCompare(b[props.sortby].toLowerCase());
				});
			}
		} else {
			if (!props.showCompleteList) {
				itemsToFilter = [];
			}
		}
		return itemsToFilter;
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
