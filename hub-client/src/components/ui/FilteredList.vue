<template>
	<div class="flex w-full flex-col">
		<div class="flex w-full items-center gap-4 pb-4">
			<Icon
				class="text-surface-high dark:text-on-surface-dim"
				type="compass"
			/>
			<TextInput
				v-if="!listTop"
				v-model="filter"
				class="bg-surface-low text-label h-8 w-full border-none"
				:class="inputClass"
				:placeholder="placeholder"
				@input="changed()"
			/>
		</div>
		<ul
			v-if="filteredItems.length > 0"
			:class="listClass + ' flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-md'"
		>
			<li
				v-for="(item, index) in filteredItems"
				:key="index"
				class="group block"
				@click="clickedItem(item)"
			>
				<slot
					v-bind="{ item }"
					name="item"
				/>
			</li>
		</ul>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type User as MatrixUser } from 'matrix-js-sdk';
	import { computed, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Models
	import { type FilteredListEvent } from '@hub-client/models/components/FilteredListEvent';

	// Types
	type Props = {
		items: Array<Record<string, unknown>>;
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
	const emit = defineEmits<{
		(e: 'click', item: Record<string, unknown>): void;
		(e: 'filter', event: FilteredListEvent): void;
	}>();
	const filter = ref('');

	const filteredItems = computed(() => {
		let itemsToFilter = props.items;

		if (props.selected && props.selected.length > 0) {
			// Check if 'selected' exists and has items
			const selectedUserIds = new Set(props.selected.map((user) => user.userId));
			itemsToFilter = itemsToFilter.filter((item) => !selectedUserIds.has(item['userId'] as string));
		}

		if (filter.value.length >= props.minLength) {
			const lcFilter = filter.value.toLowerCase();
			itemsToFilter = itemsToFilter.filter((item) => {
				if (filter.value === '') {
					return true;
				}
				for (const filterKey of props.filterKey) {
					const lcItem = (item[filterKey] as string | undefined)?.toLowerCase();
					if (lcItem && lcItem.includes(lcFilter)) return true;
				}
				return false;
			});
			if (props.sortby !== '') {
				itemsToFilter = itemsToFilter.toSorted((a: Record<string, unknown>, b: Record<string, unknown>) => {
					return (a[props.sortby] as string).toLowerCase().localeCompare((b[props.sortby] as string).toLowerCase());
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

	function clickedItem(item: Record<string, unknown>) {
		filter.value = '';
		emit('click', item);
	}
</script>
