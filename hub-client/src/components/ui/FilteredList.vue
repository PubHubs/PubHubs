<template>
	<TextInput :placeholder="placeholder" v-model="filter" class="mb-4 w-full"></TextInput>
	<ul>
		<li v-for="(item, index) in filteredItems" :key="index" class="group cursor-pointer hover:bg-green p-1 rounded" @click="clickedItem(item)">
			<slot name="item" v-bind="{ item }"></slot>
		</li>
	</ul>
</template>

<script setup lang="ts">
	import { ref, computed } from 'vue';
	const emit = defineEmits(['click']);

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
		return props.items.filter((item: any) => {
			if (filter.value == '') {
				return true;
			}
			return item[props.filterKey]?.includes(filter.value);
		});
	});

	function clickedItem(item: any) {
		emit('click', item);
	}
</script>
