<template>
	<table class="w-full table-auto border-collapse border border-surface-subtle xs:border-spacing-2 sm:border-spacing-0">
		<thead class="bg-on-surface-disabled">
			<tr>
				<th v-for="(key, index) in keys" :key="index" class="border border-surface-subtle xs:p-1 sm:p-2">
					<span class="flex">
						<span class="flex-grow text-start">
							{{ key.name }}
						</span>
						<span v-if="key.sortable" class="flex flex-col">
							<Icon type="caret-up" size="sm" @click="orderBy(key.key, false)" class="cursor-pointer" :class="activeOrderClass(key.key, false)"></Icon>
							<Icon type="caret-down" size="sm" @click="orderBy(key.key, true)" class="cursor-pointer" :class="activeOrderClass(key.key, true)"></Icon>
						</span>
					</span>
				</th>
			</tr>
		</thead>
		<tbody>
			<slot></slot>
		</tbody>
	</table>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	const emit = defineEmits(['order']);

	const orderKey = ref('');
	const orderAsc = ref(true);

	type Props = {
		keys: Array<Object>;
		sortby: string;
	};

	const props = withDefaults(defineProps<Props>(), {
		// items: () => [],
		keys: () => [],
		sortby: '',
	});

	function orderBy(key: string, asc: boolean) {
		orderKey.value = key;
		orderAsc.value = asc;
		emit('order', { key: key, asc: asc });
	}

	function activeOrderClass(key: string, asc: boolean) {
		if (orderKey.value === key && orderAsc.value === asc) {
			return '';
		}
		return 'text-on-surface-dim';
	}

	// const cols = computed(() => {
	// 	return props.keys.length;
	// });

	// const gridColsClass = computed(() => {
	// 	return 'grid-cols-' + cols.value;
	// })
</script>
